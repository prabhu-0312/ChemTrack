import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response

  if (auth.context.profile.role !== "lab_manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")?.trim()

  let query = supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("department", auth.context.profile.department)
    .neq("id", auth.context.userId)
    .order("created_at", { ascending: false })

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query

  if (error) {
    return createDatabaseErrorResponse("users.get.profiles", error, auth.context)
  }

  return NextResponse.json(data ?? [])
}

type UpdateUserBody = {
  id?: string
  status?: "approved" | "rejected"
}

export async function PATCH(req: Request) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response

  const body = (await req.json()) as UpdateUserBody
  const id = body.id?.trim()
  const status = body.status

  if (!id || !status) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (targetError) {
    return createDatabaseErrorResponse("users.patch.target", targetError, auth.context)
  }
  if (!targetProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (targetProfile.department !== auth.context.profile.department) {
    return NextResponse.json({ error: "User is not in your department" }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) {
    return createDatabaseErrorResponse("users.patch.profile", error, auth.context)
  }
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}
