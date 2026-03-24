import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type RouteContext = {
  params: Promise<{ id: string }>
}

type UpdateBody = {
  scheduled_for?: string
  maintenance_type?: string
  notes?: string
  status?: "scheduled" | "in_progress" | "completed"
  assigned_to?: string | null
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = (await req.json()) as UpdateBody
  if (!id) {
    return NextResponse.json({ error: "Maintenance id is required" }, { status: 400 })
  }

  const payload: Record<string, unknown> = {}
  if (body.scheduled_for !== undefined) payload.scheduled_for = body.scheduled_for
  if (body.maintenance_type !== undefined) payload.maintenance_type = body.maintenance_type.trim()
  if (body.notes !== undefined) payload.notes = body.notes.trim()
  if (body.status !== undefined) payload.status = body.status
  if (body.assigned_to !== undefined) payload.assigned_to = body.assigned_to?.trim() || null

  const { data, error } = await supabaseAdmin
    .from("apparatus_maintenance")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    return createDatabaseErrorResponse("maintenance.patch", error, auth.context)
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Maintenance id is required" }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from("apparatus_maintenance").delete().eq("id", id)
  if (error) {
    return createDatabaseErrorResponse("maintenance.delete", error, auth.context)
  }

  return NextResponse.json({ success: true })
}
