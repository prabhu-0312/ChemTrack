import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { ChemicalDocumentType } from "@/types/documents"

const DOC_BUCKET = "chemical-documents"
const allowedTypes: ChemicalDocumentType[] = ["msds", "safety_sheet", "protocol"]

function extractStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${DOC_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx < 0) return null
  return publicUrl.slice(idx + marker.length)
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const chemicalId = searchParams.get("chemical_id")?.trim()

  let query = auth.context.supabase
    .from("chemical_documents")
    .select("*")
    .eq("lab_id", auth.context.currentLabId)
    .order("created_at", { ascending: false })

  if (chemicalId) {
    query = query.eq("chemical_id", chemicalId)
  }

  const { data, error } = await query
  if (error) {
    return createDatabaseErrorResponse("chemical-documents.get", error, auth.context)
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const formData = await req.formData()
  const chemicalId = String(formData.get("chemical_id") ?? "").trim()
  const documentType = String(formData.get("document_type") ?? "").trim() as ChemicalDocumentType
  const file = formData.get("file")

  if (!chemicalId || !allowedTypes.includes(documentType) || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const { data: chemical, error: chemicalError } = await auth.context.supabase
    .from("chemicals")
    .select("id")
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", chemicalId)
    .maybeSingle()

  if (chemicalError || !chemical) {
    if (chemicalError) {
      return createDatabaseErrorResponse("chemical-documents.post.chemical", chemicalError, auth.context)
    }
    return NextResponse.json({ error: "Chemical not found in current lab" }, { status: 404 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${auth.context.currentLabId}/${chemicalId}/${Date.now()}-${safeName}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabaseAdmin.storage
    .from(DOC_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicData } = supabaseAdmin.storage.from(DOC_BUCKET).getPublicUrl(storagePath)
  const fileUrl = publicData.publicUrl

  const { data, error } = await auth.context.supabase
    .from("chemical_documents")
    .insert({
      lab_id: auth.context.currentLabId,
      chemical_id: chemicalId,
      document_type: documentType,
      file_url: fileUrl,
      uploaded_by: auth.context.userId,
    })
    .select()
    .single()

  if (error) {
    await supabaseAdmin.storage.from(DOC_BUCKET).remove([storagePath])
    return createDatabaseErrorResponse("chemical-documents.post", error, auth.context)
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: Request) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")?.trim()
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await auth.context.supabase
    .from("chemical_documents")
    .select("*")
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", id)
    .maybeSingle()

  if (fetchError || !existing) {
    if (fetchError) {
      return createDatabaseErrorResponse("chemical-documents.delete.fetch", fetchError, auth.context)
    }
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const storagePath = extractStoragePath(existing.file_url)
  if (storagePath) {
    await supabaseAdmin.storage.from(DOC_BUCKET).remove([storagePath])
  }

  const { error } = await auth.context.supabase
    .from("chemical_documents")
    .delete()
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", id)

  if (error) {
    return createDatabaseErrorResponse("chemical-documents.delete", error, auth.context)
  }

  return NextResponse.json({ success: true })
}
