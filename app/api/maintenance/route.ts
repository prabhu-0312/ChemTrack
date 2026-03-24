import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type MaintenanceBody = {
  apparatus_id?: string
  lab_id?: string
  scheduled_for?: string
  maintenance_type?: string
  notes?: string
  assigned_to?: string | null
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ["faculty", "lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const labId = searchParams.get("lab_id")?.trim() || auth.context.currentLabId

  if (!labId) {
    return NextResponse.json({ error: "No lab selected" }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from("apparatus_maintenance")
    .select("*")
    .eq("lab_id", labId)
    .order("scheduled_for", { ascending: true })

  if (error) {
    return createDatabaseErrorResponse("maintenance.get", error, auth.context)
  }

  const apparatusIds = [...new Set((data ?? []).map((row) => row.apparatus_id).filter(Boolean))]
  const assigneeIds = [
    ...new Set(
      (data ?? [])
        .flatMap((row) => [row.assigned_to, row.created_by])
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const [{ data: apparatus }, { data: people }] = await Promise.all([
    apparatusIds.length
      ? supabaseAdmin.from("apparatus").select("id, name, category, location").in("id", apparatusIds)
      : Promise.resolve({ data: [] }),
    assigneeIds.length
      ? supabaseAdmin.from("profiles").select("id, name, email, role").in("id", assigneeIds)
      : Promise.resolve({ data: [] }),
  ])

  const apparatusById = new Map((apparatus ?? []).map((item) => [item.id, item]))
  const peopleById = new Map((people ?? []).map((item) => [item.id, item]))

  return NextResponse.json(
    (data ?? []).map((row) => ({
      ...row,
      apparatus: apparatusById.get(row.apparatus_id) ?? null,
      assignee: row.assigned_to ? peopleById.get(row.assigned_to) ?? null : null,
      creator: row.created_by ? peopleById.get(row.created_by) ?? null : null,
    })),
  )
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const body = (await req.json()) as MaintenanceBody
  const apparatusId = body.apparatus_id?.trim()
  const labId = body.lab_id?.trim() || auth.context.currentLabId
  const scheduledFor = body.scheduled_for?.trim()
  const maintenanceType = body.maintenance_type?.trim()
  const notes = body.notes?.trim() || ""
  const assignedTo = body.assigned_to?.trim() || null

  if (!apparatusId || !labId || !scheduledFor || !maintenanceType) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("apparatus_maintenance")
    .insert({
      apparatus_id: apparatusId,
      lab_id: labId,
      scheduled_for: scheduledFor,
      maintenance_type: maintenanceType,
      notes,
      assigned_to: assignedTo,
      created_by: auth.context.userId,
    })
    .select("*")
    .single()

  if (error) {
    return createDatabaseErrorResponse("maintenance.post", error, auth.context)
  }

  return NextResponse.json(data, { status: 201 })
}
