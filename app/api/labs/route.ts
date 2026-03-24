import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type CreateLabBody = {
  name?: string
  department?: string
}

type MembershipRow = {
  lab_id: string | null
  role: string | null
  joined_at: string | null
}

type LabRow = {
  id: string
  name: string
  department: string | null
  created_by: string | null
  created_at: string | null
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response

  const { data: memberships, error: membershipsError } = await auth.context.supabase
    .from("lab_members")
    .select("lab_id, role, joined_at")
    .eq("user_id", auth.context.userId)
    .order("joined_at", { ascending: true })

  if (membershipsError) {
    return createDatabaseErrorResponse("labs.get.memberships", membershipsError, auth.context)
  }

  const membershipRows = (memberships ?? []) as MembershipRow[]
  const { data: labRows, error: labsError } = await supabaseAdmin
    .from("labs")
    .select("id, name, department, created_by, created_at")
    .eq("department", auth.context.profile.department)
    .order("created_at", { ascending: true })

  if (labsError) {
    return createDatabaseErrorResponse("labs.get.labs", labsError, auth.context)
  }

  const labs = (labRows ?? []) as LabRow[]

  const labsById = new Map(labs.map((lab) => [lab.id, lab]))
  const membershipsByLabId = new Map(
    membershipRows
      .filter((membership): membership is MembershipRow & { lab_id: string } => Boolean(membership.lab_id))
      .map((membership) => [membership.lab_id, membership]),
  )

  const hydratedLabs = labs
    .map((lab) => {
      const membership = membershipsByLabId.get(lab.id)

      return {
        ...lab,
        member_role: membership?.role ?? null,
        joined_at: membership?.joined_at ?? null,
      }
    })
    .filter((lab) => Boolean(labsById.get(lab.id)))

  return NextResponse.json({
    current_lab_id: auth.context.currentLabId ?? hydratedLabs[0]?.id ?? null,
    viewer_role: auth.context.profile.role,
    viewer_user_id: auth.context.userId,
    labs: hydratedLabs,
  })
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response

  const body = (await req.json()) as CreateLabBody
  const name = body.name?.trim()
  const department = body.department?.trim()
  if (!name || !department) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data: lab, error: labError } = await auth.context.supabase
    .from("labs")
    .insert({
      name,
      department,
      created_by: auth.context.userId,
    })
    .select()
    .single()

  if (labError) {
    return createDatabaseErrorResponse("labs.post.insert", labError, auth.context)
  }

  const { error: membershipError } = await auth.context.supabase
    .from("lab_members")
    .insert({
      lab_id: lab.id,
      user_id: auth.context.userId,
      role: "lab_manager",
    })

  if (membershipError) {
    await supabaseAdmin.from("labs").delete().eq("id", lab.id)
    return createDatabaseErrorResponse("labs.post.membership", membershipError, auth.context)
  }

  const response = NextResponse.json(lab, { status: 201 })
  response.cookies.set("current_lab_id", lab.id, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
