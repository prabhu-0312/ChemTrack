import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type RouteContext = {
  params: Promise<{ id: string }>
}

type ApparatusStatus = "available" | "in_use" | "maintenance"

type UpdateApparatusBody = {
  lab_id?: string
  name?: string
  category?: string
  location?: string
  status?: ApparatusStatus
  notes?: string
}

async function apparatusInDepartment(id: string, department: string) {
  const { data, error } = await supabaseAdmin
    .from("apparatus")
    .select("id, lab_id")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return { apparatus: data, error }
  }

  const { data: lab, error: labError } = await supabaseAdmin
    .from("labs")
    .select("id")
    .eq("id", data.lab_id)
    .eq("department", department)
    .maybeSingle()

  if (labError || !lab) {
    return { apparatus: null, error: labError }
  }

  return { apparatus: data, error: null }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = (await req.json()) as UpdateApparatusBody

  if (!id) {
    return NextResponse.json({ error: "Apparatus id is required" }, { status: 400 })
  }

  const { apparatus, error: apparatusError } = await apparatusInDepartment(
    id,
    auth.context.profile.department,
  )

  if (apparatusError) {
    return createDatabaseErrorResponse("apparatus.patch.target", apparatusError, auth.context)
  }
  if (!apparatus) {
    return NextResponse.json({ error: "Apparatus not found" }, { status: 404 })
  }

  const updatePayload: Record<string, unknown> = {}
  if (body.name !== undefined) updatePayload.name = body.name.trim()
  if (body.category !== undefined) updatePayload.category = body.category.trim()
  if (body.location !== undefined) updatePayload.location = body.location.trim()
  if (body.status !== undefined) updatePayload.status = body.status
  if (body.notes !== undefined) updatePayload.notes = body.notes.trim()
  if (body.lab_id !== undefined) updatePayload.lab_id = body.lab_id.trim()

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("apparatus")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    return createDatabaseErrorResponse("apparatus.patch", error, auth.context)
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Apparatus id is required" }, { status: 400 })
  }

  const { apparatus, error: apparatusError } = await apparatusInDepartment(
    id,
    auth.context.profile.department,
  )

  if (apparatusError) {
    return createDatabaseErrorResponse("apparatus.delete.target", apparatusError, auth.context)
  }
  if (!apparatus) {
    return NextResponse.json({ error: "Apparatus not found" }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from("apparatus").delete().eq("id", id)
  if (error) {
    return createDatabaseErrorResponse("apparatus.delete", error, auth.context)
  }

  return NextResponse.json({ success: true })
}
