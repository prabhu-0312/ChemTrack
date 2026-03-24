import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type AttendanceBody = {
  action?: "check_in" | "check_out"
  lab_id?: string
  notes?: string
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const labId = searchParams.get("lab_id")?.trim() || auth.context.currentLabId
  const isManager = auth.context.profile.role === "lab_manager"

  let query = supabaseAdmin
    .from("lab_attendance")
    .select("*")
    .order("checked_in_at", { ascending: false })

  if (labId) {
    query = query.eq("lab_id", labId)
  }
  if (!isManager) {
    query = query.eq("user_id", auth.context.userId)
  }

  const { data, error } = await query
  if (error) {
    return createDatabaseErrorResponse("attendance.get", error, auth.context)
  }

  const userIds = [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))]
  const { data: users } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id, name, email, role").in("id", userIds)
    : { data: [] }

  const usersById = new Map((users ?? []).map((user) => [user.id, user]))

  return NextResponse.json(
    (data ?? []).map((row) => ({
      ...row,
      user: usersById.get(row.user_id) ?? null,
    })),
  )
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response

  const body = (await req.json()) as AttendanceBody
  const action = body.action
  const labId = body.lab_id?.trim() || auth.context.currentLabId
  const notes = body.notes?.trim() || ""

  if (!action || !labId) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (action === "check_in") {
    const { data, error } = await supabaseAdmin
      .from("lab_attendance")
      .insert({
        lab_id: labId,
        user_id: auth.context.userId,
        notes,
      })
      .select("*")
      .single()

    if (error) {
      return createDatabaseErrorResponse("attendance.post.checkin", error, auth.context)
    }

    return NextResponse.json(data, { status: 201 })
  }

  const { data: activeAttendance, error: activeError } = await supabaseAdmin
    .from("lab_attendance")
    .select("*")
    .eq("lab_id", labId)
    .eq("user_id", auth.context.userId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .maybeSingle()

  if (activeError) {
    return createDatabaseErrorResponse("attendance.post.active", activeError, auth.context)
  }
  if (!activeAttendance) {
    return NextResponse.json({ error: "No active check-in found" }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from("lab_attendance")
    .update({
      checked_out_at: new Date().toISOString(),
      notes: notes || activeAttendance.notes,
    })
    .eq("id", activeAttendance.id)
    .select("*")
    .single()

  if (error) {
    return createDatabaseErrorResponse("attendance.post.checkout", error, auth.context)
  }

  return NextResponse.json(data)
}
