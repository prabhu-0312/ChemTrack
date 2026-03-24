import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const labId = searchParams.get("lab_id")?.trim() || auth.context.currentLabId

  if (!labId) {
    return NextResponse.json({ error: "No lab selected" }, { status: 404 })
  }

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceIso = since.toISOString()

  const [
    { data: bookings, error: bookingsError },
    { data: apparatusBookings, error: apparatusBookingsError },
    { data: incidents, error: incidentsError },
    { data: maintenance, error: maintenanceError },
    { data: attendance, error: attendanceError },
  ] = await Promise.all([
    supabaseAdmin.from("bookings").select("id,status").eq("lab_id", labId).gte("created_at", sinceIso),
    supabaseAdmin.from("apparatus_bookings").select("id,status").eq("lab_id", labId).gte("created_at", sinceIso),
    supabaseAdmin.from("lab_incidents").select("id,status,severity").eq("lab_id", labId).gte("created_at", sinceIso),
    supabaseAdmin.from("apparatus_maintenance").select("id,status").eq("lab_id", labId).gte("created_at", sinceIso),
    supabaseAdmin.from("lab_attendance").select("id,user_id").eq("lab_id", labId).gte("created_at", sinceIso),
  ])

  if (bookingsError) return createDatabaseErrorResponse("analytics.bookings", bookingsError, auth.context)
  if (apparatusBookingsError) return createDatabaseErrorResponse("analytics.apparatus-bookings", apparatusBookingsError, auth.context)
  if (incidentsError) return createDatabaseErrorResponse("analytics.incidents", incidentsError, auth.context)
  if (maintenanceError) return createDatabaseErrorResponse("analytics.maintenance", maintenanceError, auth.context)
  if (attendanceError) return createDatabaseErrorResponse("analytics.attendance", attendanceError, auth.context)

  return NextResponse.json({
    period_days: 30,
    lab_id: labId,
    lab_bookings: {
      total: bookings?.length ?? 0,
      approved: bookings?.filter((item) => item.status === "approved").length ?? 0,
      pending: bookings?.filter((item) => item.status === "pending").length ?? 0,
      rejected: bookings?.filter((item) => item.status === "rejected").length ?? 0,
    },
    apparatus_bookings: {
      total: apparatusBookings?.length ?? 0,
      approved: apparatusBookings?.filter((item) => item.status === "approved").length ?? 0,
      pending: apparatusBookings?.filter((item) => item.status === "pending").length ?? 0,
    },
    incidents: {
      total: incidents?.length ?? 0,
      open: incidents?.filter((item) => item.status === "open").length ?? 0,
      resolved: incidents?.filter((item) => item.status === "resolved").length ?? 0,
      critical: incidents?.filter((item) => item.severity === "critical").length ?? 0,
    },
    maintenance: {
      total: maintenance?.length ?? 0,
      scheduled: maintenance?.filter((item) => item.status === "scheduled").length ?? 0,
      in_progress: maintenance?.filter((item) => item.status === "in_progress").length ?? 0,
      completed: maintenance?.filter((item) => item.status === "completed").length ?? 0,
    },
    attendance: {
      total_entries: attendance?.length ?? 0,
      unique_people: new Set((attendance ?? []).map((item) => item.user_id)).size,
    },
  })
}
