import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type RouteContext = {
  params: Promise<{ id: string }>
}

type UpdateBody = {
  status?: "approved" | "rejected"
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = (await req.json()) as UpdateBody
  const status = body.status

  if (!id || !status) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("apparatus_bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (bookingError) {
    return createDatabaseErrorResponse("apparatus-bookings.patch.target", bookingError, auth.context)
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (status === "approved") {
    const { data: conflict, error: conflictError } = await supabaseAdmin
      .from("apparatus_bookings")
      .select("id")
      .eq("apparatus_id", booking.apparatus_id)
      .eq("booking_date", booking.booking_date)
      .eq("time_slot", booking.time_slot)
      .eq("status", "approved")
      .neq("id", booking.id)
      .maybeSingle()

    if (conflictError) {
      return createDatabaseErrorResponse("apparatus-bookings.patch.conflict", conflictError, auth.context)
    }
    if (conflict) {
      return NextResponse.json({ error: "This apparatus slot is already approved." }, { status: 409 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from("apparatus_bookings")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    return createDatabaseErrorResponse("apparatus-bookings.patch", error, auth.context)
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["faculty", "lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Booking id is required" }, { status: 400 })
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("apparatus_bookings")
    .select("id, requested_by")
    .eq("id", id)
    .maybeSingle()

  if (bookingError) {
    return createDatabaseErrorResponse("apparatus-bookings.delete.target", bookingError, auth.context)
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (auth.context.profile.role !== "lab_manager" && booking.requested_by !== auth.context.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from("apparatus_bookings").delete().eq("id", id)
  if (error) {
    return createDatabaseErrorResponse("apparatus-bookings.delete", error, auth.context)
  }

  return NextResponse.json({ success: true })
}
