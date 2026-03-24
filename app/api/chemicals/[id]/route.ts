import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"

type RouteContext = {
  params: Promise<{ id: string }>
}

type UpdateChemicalBody = {
  quantity?: number | string
  location?: string
  hazard_level?: 'Low' | 'Medium' | 'High'
}

export async function PUT(req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(req, ["lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json()) as UpdateChemicalBody

  const quantity = Number(body.quantity)
  const location = body.location?.trim()
  const hazardLevel = body.hazard_level

  if (!id || Number.isNaN(quantity) || !location || !hazardLevel) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data, error } = await auth.context.supabase
    .from("chemicals")
    .update({
      quantity,
      location,
      hazard_level: hazardLevel,
    })
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) {
    return createDatabaseErrorResponse("chemicals.put", error, auth.context)
  }
  if (!data) {
    return NextResponse.json({ error: "Chemical not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await requireApiAuth(_req, ["lab_manager"])
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: "Chemical id is required" }, { status: 400 })
  }

  const { error } = await auth.context.supabase
    .from("chemicals")
    .delete()
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", id)

  if (error) {
    return createDatabaseErrorResponse("chemicals.delete", error, auth.context)
  }

  return NextResponse.json({ success: true })
}
