import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import type { AuthContext } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type CreateBookingBody = {
  lab_id?: string
  booking_date?: string
  time_slot?: string
  purpose?: string
}

type BookingRow = {
  id: string
  lab_id: string | null
  user_id: string | null
  chemical_id: string | null
  quantity: number | null
  status: "pending" | "approved" | "rejected"
  requested_at?: string | null
  booking_date: string
  time_slot: string | null
  created_at: string
}

type LabRow = {
  id: string
  name: string
}

type ProfileRow = {
  id: string
  name: string
  email: string
}

function attachLabsToBookings(bookings: BookingRow[], labs: LabRow[]) {
  const labsById = new Map(labs.map((lab) => [lab.id, lab]))

  return bookings.map((booking) => ({
    ...booking,
    labs: booking.lab_id ? labsById.get(booking.lab_id) ?? null : null,
  }))
}

function normalizeTimeSlot(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function parseBookingDate(dateInput: string): {
  dateOnly: string
  startIso: string
  endIso: string
  storedIso: string
} | null {
  const trimmed = dateInput.trim()
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)

  let year: number
  let month: number
  let day: number

  if (dateOnlyMatch) {
    year = Number(dateOnlyMatch[1])
    month = Number(dateOnlyMatch[2])
    day = Number(dateOnlyMatch[3])
  } else {
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) {
      return null
    }

    year = parsed.getUTCFullYear()
    month = parsed.getUTCMonth() + 1
    day = parsed.getUTCDate()
  }

  const dateOnly = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`

  const startIso = `${dateOnly}T00:00:00.000Z`
  const endDate = new Date(startIso)
  endDate.setUTCDate(endDate.getUTCDate() + 1)

  return {
    dateOnly,
    startIso,
    endIso: endDate.toISOString(),
    storedIso: startIso,
  }
}

async function getDepartmentLabIds(context: AuthContext) {
  const { data, error } = await supabaseAdmin
    .from("labs")
    .select("id")
    .eq("department", context.profile.department)

  if (error) {
    throw error
  }

  return [
    ...new Set(
      (data ?? [])
        .map((lab: { id: string | null }) => lab.id)
        .filter((labId): labId is string => Boolean(labId)),
    ),
  ]
}

async function attachRequestersToBookings(bookings: ReturnType<typeof attachLabsToBookings>) {
  const userIds = [
    ...new Set(bookings.map((booking) => booking.user_id).filter((userId): userId is string => Boolean(userId))),
  ]

  if (userIds.length === 0) {
    return bookings.map((booking) => ({
      ...booking,
      requester: null,
    }))
  }

  const { data, error } = await supabaseAdmin.from("profiles").select("id, name, email").in("id", userIds)
  if (error) {
    throw error
  }

  const requestersById = new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))

  return bookings.map((booking) => ({
    ...booking,
    requester: booking.user_id ? requestersById.get(booking.user_id) ?? null : null,
  }))
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response

  const { context } = auth
  const { searchParams } = new URL(req.url)
  const requestedLabId = searchParams.get("lab_id")?.trim() || null
  const status = searchParams.get("status")?.trim() || null
  const allowedLabIds = await getDepartmentLabIds(context)
  const targetLabId = requestedLabId || context.currentLabId || allowedLabIds[0] || null

  if (!targetLabId && !(context.profile.role === "lab_manager" && status)) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  if (requestedLabId && !allowedLabIds.includes(requestedLabId)) {
    return NextResponse.json({ error: "Forbidden for selected lab" }, { status: 403 })
  }

  let bookingsQuery = supabaseAdmin
    .from("bookings")
    .select("*")
    .order("booking_date", { ascending: true })
    .order("time_slot", { ascending: true })

  if (requestedLabId) {
    bookingsQuery = bookingsQuery.eq("lab_id", requestedLabId)
  } else if (context.profile.role === "lab_manager" && status) {
    bookingsQuery = bookingsQuery.in("lab_id", allowedLabIds)
  } else if (targetLabId) {
    bookingsQuery = bookingsQuery.eq("lab_id", targetLabId)
  }

  if (status) {
    bookingsQuery = bookingsQuery.eq("status", status)
  }

  const { data, error } = await bookingsQuery

  if (error) {
    return createDatabaseErrorResponse("bookings.get", error, context)
  }

  const bookings = (data ?? []) as BookingRow[]
  const labIds = [...new Set(bookings.map((booking) => booking.lab_id).filter(Boolean))] as string[]

  let labs: LabRow[] = []
  if (labIds.length > 0) {
    const { data: labRows, error: labsError } = await supabaseAdmin
      .from("labs")
      .select("id, name")
      .in("id", labIds)

    if (labsError) {
      return createDatabaseErrorResponse("bookings.get.labs", labsError, context)
    }

    labs = (labRows ?? []) as LabRow[]
  }

  try {
    const bookingsWithLabs = attachLabsToBookings(bookings, labs)
    const bookingsWithRequesters = await attachRequestersToBookings(bookingsWithLabs)
    return NextResponse.json(bookingsWithRequesters)
  } catch (attachError) {
    const errorLike =
      attachError instanceof Error ? { message: attachError.message } : { message: "Unable to attach booking requesters" }
    return createDatabaseErrorResponse(
      "bookings.get.requesters",
      errorLike,
      context,
    )
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["faculty", "lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const { context } = auth
  const body = (await req.json()) as CreateBookingBody
  const labId = body.lab_id?.trim()
  const bookingDate = body.booking_date?.trim()
  const timeSlot = normalizeTimeSlot(body.time_slot)
  const purpose = body.purpose?.trim() || null

  if (!labId || !bookingDate || !timeSlot) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const allowedLabIds = await getDepartmentLabIds(context)
  if (!allowedLabIds.includes(labId)) {
    return NextResponse.json({ error: "Forbidden for selected lab" }, { status: 403 })
  }

  const parsedBookingDate = parseBookingDate(bookingDate)
  if (!parsedBookingDate) {
    return NextResponse.json({ error: "Invalid booking date" }, { status: 400 })
  }

  const { data: existingConflict, error: conflictError } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("lab_id", labId)
    .eq("time_slot", timeSlot)
    .gte("booking_date", parsedBookingDate.startIso)
    .lt("booking_date", parsedBookingDate.endIso)
    .eq("status", "approved")
    .maybeSingle()

  if (conflictError) {
    return createDatabaseErrorResponse("bookings.post.conflict", conflictError, context)
  }
  if (existingConflict) {
    return NextResponse.json(
      { error: "Booking conflict: this lab is already booked for the selected slot." },
      { status: 409 },
    )
  }

  const { data: existingRequest, error: existingRequestError } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("lab_id", labId)
    .eq("user_id", context.userId)
    .eq("time_slot", timeSlot)
    .gte("booking_date", parsedBookingDate.startIso)
    .lt("booking_date", parsedBookingDate.endIso)
    .in("status", ["pending", "approved"])
    .maybeSingle()

  if (existingRequestError) {
    return createDatabaseErrorResponse("bookings.post.duplicate", existingRequestError, context)
  }
  if (existingRequest) {
    return NextResponse.json(
      { error: "You already have a request for this lab slot." },
      { status: 409 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      lab_id: labId,
      user_id: context.userId,
      booking_date: parsedBookingDate.storedIso,
      time_slot: timeSlot,
      status: "pending",
      quantity: null,
      chemical_id: null,
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Booking conflict: this lab is already booked for the selected slot." },
        { status: 409 },
      )
    }

    return createDatabaseErrorResponse("bookings.post.insert", error, context)
  }

  const booking = data as BookingRow
  const { data: lab, error: labError } = await supabaseAdmin
    .from("labs")
    .select("id, name")
    .eq("id", labId)
    .maybeSingle()

  if (labError) {
    return createDatabaseErrorResponse("bookings.post.lab", labError, context)
  }

  const bookingWithLab = {
    ...booking,
    labs: (lab as LabRow | null) ?? null,
  }

  const { data: managers } = await supabaseAdmin
    .from("lab_members")
    .select("user_id, profiles!inner(status)")
    .eq("lab_id", labId)
    .eq("role", "lab_manager")
    .eq("profiles.status", "approved")

  if (managers && managers.length > 0) {
    await supabaseAdmin.from("notifications").insert(
      managers.map((manager) => ({
        lab_id: labId,
        user_id: manager.user_id,
        type: "booking_pending",
        message: `New booking request for ${bookingWithLab.labs?.name ?? "selected lab"} on ${parsedBookingDate.dateOnly} (${timeSlot}).${purpose ? ` Purpose: ${purpose}.` : ""}`,
      })),
    )
  }

  return NextResponse.json(bookingWithLab, { status: 201 })
}
