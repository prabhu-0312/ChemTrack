import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type RouteContext = {
  params: Promise<{ id: string }>
}

type UpdateBookingBody = {
  status?: "approved" | "rejected"
}

type BookingRow = {
  id: string
  lab_id: string | null
  user_id: string | null
  booking_date: string
  time_slot: string | null
  status: "pending" | "approved" | "rejected"
}

async function getDepartmentLab(booking: BookingRow, managerDepartment: string) {
  if (!booking.lab_id) {
    return { lab: null, error: null }
  }

  const { data: lab, error } = await supabaseAdmin
    .from("labs")
    .select("id, name, department")
    .eq("id", booking.lab_id)
    .eq("department", managerDepartment)
    .maybeSingle()

  return { lab, error }
}

async function getBookingById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, lab_id, user_id, booking_date, time_slot, status")
    .eq("id", id)
    .maybeSingle()

  return { data: (data as BookingRow | null) ?? null, error }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = (await req.json()) as UpdateBookingBody
  const nextStatus = body.status

  if (!id || !nextStatus || !["approved", "rejected"].includes(nextStatus)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data: booking, error: bookingError } = await getBookingById(id)

  if (bookingError) {
    return createDatabaseErrorResponse("bookings.patch.target", bookingError, auth.context)
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking request not found" }, { status: 404 })
  }

  const targetBooking = booking as BookingRow
  if (!targetBooking.lab_id) {
    return NextResponse.json({ error: "Booking has no lab assigned" }, { status: 400 })
  }

  const { lab, error: labError } = await getDepartmentLab(targetBooking, auth.context.profile.department)

  if (labError) {
    return createDatabaseErrorResponse("bookings.patch.lab", labError, auth.context)
  }
  if (!lab) {
    return NextResponse.json({ error: "Booking is not in your department" }, { status: 403 })
  }

  if (nextStatus === "approved") {
    const { data: existingApproved, error: conflictError } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("lab_id", targetBooking.lab_id)
      .eq("time_slot", targetBooking.time_slot)
      .eq("booking_date", targetBooking.booking_date)
      .eq("status", "approved")
      .neq("id", targetBooking.id)
      .maybeSingle()

    if (conflictError) {
      return createDatabaseErrorResponse("bookings.patch.conflict", conflictError, auth.context)
    }
    if (existingApproved) {
      return NextResponse.json(
        { error: "This slot has already been approved for another booking." },
        { status: 409 },
      )
    }
  }

  const { data: updatedBooking, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ status: nextStatus })
    .eq("id", targetBooking.id)
    .select("*")
    .maybeSingle()

  if (updateError) {
    return createDatabaseErrorResponse("bookings.patch.update", updateError, auth.context)
  }
  if (!updatedBooking) {
    return NextResponse.json({ error: "Booking request not found" }, { status: 404 })
  }

  if (targetBooking.user_id) {
    await supabaseAdmin.from("notifications").insert({
      lab_id: targetBooking.lab_id,
      user_id: targetBooking.user_id,
      type: nextStatus === "approved" ? "booking_approved" : "booking_rejected",
      message: `Your booking request for ${lab.name} on ${targetBooking.booking_date.slice(0, 10)} (${targetBooking.time_slot ?? "time slot"}) was ${nextStatus}.`,
    })
  }

  return NextResponse.json({
    ...updatedBooking,
    labs: {
      id: lab.id,
      name: lab.name,
    },
  })
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["faculty", "lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Booking id is required" }, { status: 400 })
  }

  const { data: booking, error: bookingError } = await getBookingById(id)

  if (bookingError) {
    return createDatabaseErrorResponse("bookings.delete.target", bookingError, auth.context)
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking request not found" }, { status: 404 })
  }
  if (!booking.lab_id) {
    return NextResponse.json({ error: "Booking has no lab assigned" }, { status: 400 })
  }

  if (auth.context.profile.role === "lab_manager") {
    const { lab, error: labError } = await getDepartmentLab(booking, auth.context.profile.department)

    if (labError) {
      return createDatabaseErrorResponse("bookings.delete.lab", labError, auth.context)
    }
    if (!lab) {
      return NextResponse.json({ error: "Booking is not in your department" }, { status: 403 })
    }
  } else {
    if (booking.user_id !== auth.context.userId) {
      return NextResponse.json({ error: "You can only cancel your own booking requests" }, { status: 403 })
    }
    if (!["pending", "approved"].includes(booking.status)) {
      return NextResponse.json({ error: "Only pending or approved requests can be cancelled" }, { status: 400 })
    }
  }

  const { error: deleteError } = await supabaseAdmin.from("bookings").delete().eq("id", booking.id)

  if (deleteError) {
    return createDatabaseErrorResponse("bookings.delete", deleteError, auth.context)
  }

  return NextResponse.json({ success: true })
}
