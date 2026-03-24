import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type ApparatusBookingBody = {
  apparatus_id?: string
  lab_id?: string
  booking_date?: string
  time_slot?: string
  purpose?: string
}

async function getDepartmentLabs(department: string) {
  const { data, error } = await supabaseAdmin
    .from("labs")
    .select("id, name")
    .eq("department", department)

  if (error) throw error
  return data ?? []
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const requestedLabId = searchParams.get("lab_id")?.trim() || auth.context.currentLabId
  const status = searchParams.get("status")?.trim() || null

  let departmentLabs: Array<{ id: string; name: string }> = []
  try {
    departmentLabs = await getDepartmentLabs(auth.context.profile.department)
  } catch (error) {
    return createDatabaseErrorResponse(
      "apparatus-bookings.get.labs",
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

  let query = supabaseAdmin
    .from("apparatus_bookings")
    .select("*")
    .eq("lab_id", requestedLabId)
    .order("booking_date", { ascending: true })
    .order("time_slot", { ascending: true })

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) {
    return createDatabaseErrorResponse("apparatus-bookings.get", error, auth.context)
  }

  const rows = data ?? []
  const apparatusIds = [...new Set(rows.map((row) => row.apparatus_id).filter(Boolean))]
  const requesterIds = [...new Set(rows.map((row) => row.requested_by).filter(Boolean))]

  const [{ data: apparatus }, { data: requesters }] = await Promise.all([
    apparatusIds.length
      ? supabaseAdmin.from("apparatus").select("id, name, category, location, status").in("id", apparatusIds)
      : Promise.resolve({ data: [] }),
    requesterIds.length
      ? supabaseAdmin.from("profiles").select("id, name, email, role").in("id", requesterIds)
      : Promise.resolve({ data: [] }),
  ])

  const apparatusById = new Map((apparatus ?? []).map((item) => [item.id, item]))
  const requestersById = new Map((requesters ?? []).map((item) => [item.id, item]))

  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      apparatus: apparatusById.get(row.apparatus_id) ?? null,
      requester: requestersById.get(row.requested_by) ?? null,
    })),
  )
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["faculty", "lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const body = (await req.json()) as ApparatusBookingBody
  const apparatusId = body.apparatus_id?.trim()
  const labId = body.lab_id?.trim() || auth.context.currentLabId
  const bookingDate = body.booking_date?.trim()
  const timeSlot = body.time_slot?.trim()
  const purpose = body.purpose?.trim() || ""

  if (!apparatusId || !labId || !bookingDate || !timeSlot) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data: apparatus, error: apparatusError } = await supabaseAdmin
    .from("apparatus")
    .select("id, lab_id, name")
    .eq("id", apparatusId)
    .eq("lab_id", labId)
    .maybeSingle()

  if (apparatusError) {
    return createDatabaseErrorResponse("apparatus-bookings.post.apparatus", apparatusError, auth.context)
  }
  if (!apparatus) {
    return NextResponse.json({ error: "Apparatus not found in selected lab" }, { status: 404 })
  }

  const dayIso = `${bookingDate}T00:00:00.000Z`
  const nextDay = new Date(dayIso)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)

  const { data: conflict, error: conflictError } = await supabaseAdmin
    .from("apparatus_bookings")
    .select("id")
    .eq("apparatus_id", apparatusId)
    .gte("booking_date", dayIso)
    .lt("booking_date", nextDay.toISOString())
    .eq("time_slot", timeSlot)
    .eq("status", "approved")
    .maybeSingle()

  if (conflictError) {
    return createDatabaseErrorResponse("apparatus-bookings.post.conflict", conflictError, auth.context)
  }
  if (conflict) {
    return NextResponse.json({ error: "This apparatus is already booked for that slot." }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from("apparatus_bookings")
    .insert({
      apparatus_id: apparatusId,
      lab_id: labId,
      requested_by: auth.context.userId,
      booking_date: dayIso,
      time_slot: timeSlot,
      purpose,
      status: "pending",
    })
    .select("*")
    .single()

  if (error) {
    return createDatabaseErrorResponse("apparatus-bookings.post", error, auth.context)
  }

  return NextResponse.json(data, { status: 201 })
}
