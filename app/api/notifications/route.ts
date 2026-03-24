import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"

type CreateNotificationBody = {
  user_id?: string
  type?: string
  message?: string
}

type UpdateNotificationBody = {
  id?: string
  read?: boolean
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { context } = auth
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get("unread") === "true"

  let query = context.supabase
    .from("notifications")
    .select("*")
    .eq("lab_id", auth.context.currentLabId)
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false })

  if (unreadOnly) {
    query = query.eq("read", false)
  }

  const { data, error } = await query
  if (error) {
    return createDatabaseErrorResponse("notifications.get", error, auth.context)
  }

  return NextResponse.json(data ?? [])
}

export async function PATCH(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const body = (await req.json()) as UpdateNotificationBody
  const id = body.id?.trim()
  if (!id || body.read === undefined) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data, error } = await auth.context.supabase
    .from("notifications")
    .update({ read: Boolean(body.read) })
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", id)
    .eq("user_id", auth.context.userId)
    .select()
    .maybeSingle()

  if (error) {
    return createDatabaseErrorResponse("notifications.patch", error, auth.context)
  }
  if (!data) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const body = (await req.json()) as CreateNotificationBody
  const userId = body.user_id?.trim()
  const type = body.type?.trim()
  const message = body.message?.trim()

  if (!userId || !type || !message) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data: membership, error: membershipError } = await auth.context.supabase
    .from("lab_members")
    .select("id")
    .eq("lab_id", auth.context.currentLabId)
    .eq("user_id", userId)
    .maybeSingle()

  if (membershipError) {
    return createDatabaseErrorResponse("notifications.post.membership", membershipError, auth.context)
  }
  if (!membership) {
    return NextResponse.json({ error: "User is not a member of the current lab" }, { status: 400 })
  }

  const { data, error } = await auth.context.supabase
    .from("notifications")
    .insert({
      lab_id: auth.context.currentLabId,
      user_id: userId,
      type,
      message,
    })
    .select()
    .single()

  if (error) {
    return createDatabaseErrorResponse("notifications.post", error, auth.context)
  }

  return NextResponse.json(data, { status: 201 })
}
