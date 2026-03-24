import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type ApparatusStatus = "available" | "in_use" | "maintenance"

type ApparatusBody = {
  lab_id?: string
  name?: string
  category?: string
  location?: string
  status?: ApparatusStatus
  notes?: string
}

async function getDepartmentLabs(department: string) {
  const { data, error } = await supabaseAdmin
    .from("labs")
    .select("id, name")
    .eq("department", department)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const requestedLabId = searchParams.get("lab_id")?.trim() || auth.context.currentLabId

  let departmentLabs: Array<{ id: string; name: string }> = []
  try {
    departmentLabs = await getDepartmentLabs(auth.context.profile.department)
  } catch (error) {
    return createDatabaseErrorResponse(
      "apparatus.get.labs",
      error instanceof Error ? { message: error.message } : { message: "Unable to load labs" },
      auth.context,
    )
  }

  if (!requestedLabId) {
    return NextResponse.json({ error: "No lab selected" }, { status: 404 })
  }
  if (!departmentLabs.some((lab) => lab.id === requestedLabId)) {
    return NextResponse.json({ error: "Forbidden for selected lab" }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from("apparatus")
    .select("*")
    .eq("lab_id", requestedLabId)
    .order("created_at", { ascending: false })

  if (error) {
    return createDatabaseErrorResponse("apparatus.get", error, auth.context)
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const body = (await req.json()) as ApparatusBody
  const labId = body.lab_id?.trim() || auth.context.currentLabId
  const name = body.name?.trim()
  const category = body.category?.trim()
  const location = body.location?.trim()
  const notes = body.notes?.trim() ?? ""
  const status = body.status ?? "available"

  if (!labId || !name || !category || !location) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  let departmentLabs: Array<{ id: string; name: string }> = []
  try {
    departmentLabs = await getDepartmentLabs(auth.context.profile.department)
  } catch (error) {
    return createDatabaseErrorResponse(
      "apparatus.post.labs",
      error instanceof Error ? { message: error.message } : { message: "Unable to load labs" },
      auth.context,
    )
  }

  if (!departmentLabs.some((lab) => lab.id === labId)) {
    return NextResponse.json({ error: "Forbidden for selected lab" }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from("apparatus")
    .insert({
      lab_id: labId,
      name,
      category,
      location,
      status,
      notes,
      created_by: auth.context.userId,
    })
    .select("*")
    .single()

  if (error) {
    return createDatabaseErrorResponse("apparatus.post", error, auth.context)
  }

  return NextResponse.json(data, { status: 201 })
}
