import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type IncidentRow = {
  id: string
  lab_id: string
  reported_by: string
  category: "accident" | "spill" | "equipment_breakage" | "missing_item" | "near_miss" | "other"
  severity: "low" | "medium" | "high" | "critical"
  location: string
  description: string
  status: "open" | "under_review" | "resolved"
  resolved_at: string | null
  created_at: string
}

type IncidentBody = {
  lab_id?: string
  category?: IncidentRow["category"]
  severity?: IncidentRow["severity"]
  location?: string
  description?: string
}

async function getDepartmentLabs(department: string) {
  const { data, error } = await supabaseAdmin
    .from("labs")
    .select("id, name, department")
    .eq("department", department)
    .order("created_at", { ascending: true })

  if (error) throw error

  return data ?? []
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ["faculty", "lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const requestedLabId = searchParams.get("lab_id")?.trim() || null

  let departmentLabs: Array<{ id: string; name: string; department: string | null }> = []
  try {
    departmentLabs = await getDepartmentLabs(auth.context.profile.department)
  } catch (error) {
    return createDatabaseErrorResponse(
      "incidents.get.labs",
      error instanceof Error ? { message: error.message } : { message: "Unable to load labs" },
      auth.context,
    )
  }

  const allowedLabIds = departmentLabs.map((lab) => lab.id)
  if (requestedLabId && !allowedLabIds.includes(requestedLabId)) {
    return NextResponse.json({ error: "Forbidden for selected lab" }, { status: 403 })
  }

  let query = supabaseAdmin
    .from("lab_incidents")
    .select("*")
    .order("created_at", { ascending: false })

  if (requestedLabId) {
    query = query.eq("lab_id", requestedLabId)
  } else if (allowedLabIds.length > 0) {
    query = query.in("lab_id", allowedLabIds)
  }

  const { data, error } = await query
  if (error) {
    return createDatabaseErrorResponse("incidents.get", error, auth.context)
  }

  const incidents = (data ?? []) as IncidentRow[]
  const reporterIds = [...new Set(incidents.map((incident) => incident.reported_by))]
  const { data: reporters, error: reportersError } = reporterIds.length
    ? await supabaseAdmin.from("profiles").select("id, name, email, role").in("id", reporterIds)
    : { data: [], error: null }

  if (reportersError) {
    return createDatabaseErrorResponse("incidents.get.reporters", reportersError, auth.context)
  }

  const labsById = new Map(departmentLabs.map((lab) => [lab.id, lab]))
  const reportersById = new Map((reporters ?? []).map((reporter) => [reporter.id, reporter]))

  return NextResponse.json(
    incidents.map((incident) => ({
      ...incident,
      lab: labsById.get(incident.lab_id) ?? null,
      reporter: reportersById.get(incident.reported_by) ?? null,
    })),
  )
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["faculty", "lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const body = (await req.json()) as IncidentBody
  const labId = body.lab_id?.trim()
  const location = body.location?.trim()
  const description = body.description?.trim()
  const category = body.category
  const severity = body.severity

  if (!labId || !location || !description || !category || !severity) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  let departmentLabs: Array<{ id: string; name: string; department: string | null }> = []
  try {
    departmentLabs = await getDepartmentLabs(auth.context.profile.department)
  } catch (error) {
    return createDatabaseErrorResponse(
      "incidents.post.labs",
      error instanceof Error ? { message: error.message } : { message: "Unable to load labs" },
      auth.context,
    )
  }

  if (!departmentLabs.some((lab) => lab.id === labId)) {
    return NextResponse.json({ error: "Forbidden for selected lab" }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from("lab_incidents")
    .insert({
      lab_id: labId,
      reported_by: auth.context.userId,
      category,
      severity,
      location,
      description,
      status: "open",
    })
    .select("*")
    .single()

  if (error) {
    return createDatabaseErrorResponse("incidents.post", error, auth.context)
  }

  const { data: recipients } = await supabaseAdmin
    .from("lab_members")
    .select("user_id, role, profiles!inner(status)")
    .eq("lab_id", labId)
    .in("role", ["lab_assistant", "lab_manager"])
    .eq("profiles.status", "approved")

  if (recipients && recipients.length > 0) {
    await supabaseAdmin.from("notifications").insert(
      recipients.map((recipient) => ({
        lab_id: labId,
        user_id: recipient.user_id,
        type: "incident_reported",
        message: `New ${category.replaceAll("_", " ")} reported at ${location}.`,
      })),
    )
  }

  return NextResponse.json(data, { status: 201 })
}
