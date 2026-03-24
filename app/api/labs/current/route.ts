import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"

type SetCurrentLabBody = {
  lab_id?: string
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    current_lab_id: auth.context.currentLabId,
  })
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response

  const body = (await req.json()) as SetCurrentLabBody
  const labId = body.lab_id?.trim()
  if (!labId) {
    return NextResponse.json({ error: "lab_id is required" }, { status: 400 })
  }

  const { data: membership, error } = await auth.context.supabase
    .from("lab_members")
    .select("lab_id")
    .eq("lab_id", labId)
    .eq("user_id", auth.context.userId)
    .maybeSingle()

  if (error) {
    return createDatabaseErrorResponse("labs.current.post.membership", error, auth.context)
  }
  if (!membership) {
    return NextResponse.json({ error: "Forbidden for selected lab" }, { status: 403 })
  }

  const response = NextResponse.json({ success: true, current_lab_id: labId })
  response.cookies.set("current_lab_id", labId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
