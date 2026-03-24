import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type RouteContext = {
  params: Promise<{ id: string }>
}

type UpdateIncidentBody = {
  status?: "open" | "under_review" | "resolved"
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = (await req.json()) as UpdateIncidentBody
  const status = body.status

  if (!id || !status) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data: incident, error: incidentError } = await supabaseAdmin
    .from("lab_incidents")
    .select("id, lab_id")
    .eq("id", id)
    .maybeSingle()

  if (incidentError) {
    return createDatabaseErrorResponse("incidents.patch.target", incidentError, auth.context)
  }
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 })
  }

  const { data: lab, error: labError } = await supabaseAdmin
    .from("labs")
    .select("id")
    .eq("id", incident.lab_id)
    .eq("department", auth.context.profile.department)
    .maybeSingle()

  if (labError) {
    return createDatabaseErrorResponse("incidents.patch.lab", labError, auth.context)
  }
  if (!lab) {
    return NextResponse.json({ error: "Forbidden for selected incident" }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from("lab_incidents")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) {
    return createDatabaseErrorResponse("incidents.patch", error, auth.context)
  }

  return NextResponse.json(data)
}
