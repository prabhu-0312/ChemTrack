import { NextResponse } from "next/server"

import {
  createDatabaseErrorResponse,
  isMissingColumnError,
  requireApiAuth,
} from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type CreateContainerBody = {
  chemical_id?: string
  container_code?: string
  barcode?: string
  batch_number?: string
  quantity?: number | string
  unit?: string
  location?: string
  expiry_date?: string
  opened_at?: string
  status?: "available" | "empty" | "expired" | "disposed"
}

type UpdateContainerBody = {
  quantity?: number | string
  location?: string
  expiry_date?: string
  opened_at?: string
  status?: "available" | "empty" | "expired" | "disposed"
}

function generateBarcode(): string {
  return `CT-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`
}

function computeExpiryFlags(expiryDate: string | null, status: string) {
  if (!expiryDate || status === "disposed") {
    return { expired: false, warning: false }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)

  const diffMs = expiry.getTime() - today.getTime()
  const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return {
    expired: daysRemaining < 0,
    warning: daysRemaining >= 0 && daysRemaining < 30,
  }
}

async function notifyInventoryTeam(labId: string, type: string, message: string) {
  const { data: recipients, error: recipientsError } = await supabaseAdmin
    .from("lab_members")
    .select("user_id, profiles!inner(status)")
    .eq("lab_id", labId)
    .in("role", ["lab_assistant", "lab_manager"])
    .eq("profiles.status", "approved")

  if (recipientsError || !recipients || recipients.length === 0) {
    return
  }

  const notifications = recipients.map((member) => ({
    lab_id: labId,
    user_id: member.user_id,
    type,
    message,
  }))

  await supabaseAdmin.from("notifications").insert(notifications)
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const chemicalId = searchParams.get("chemical_id")?.trim()

  let query = auth.context.supabase
    .from("chemical_containers")
    .select("*")
    .eq("lab_id", auth.context.currentLabId)
    .order("created_at", { ascending: false })

  if (chemicalId) {
    query = query.eq("chemical_id", chemicalId)
  }

  let { data, error } = await query
  if (error && isMissingColumnError(error, "chemical_containers.lab_id")) {
    let legacyQuery = auth.context.supabase
      .from("chemical_containers")
      .select("*")
      .order("created_at", { ascending: false })

    if (chemicalId) {
      legacyQuery = legacyQuery.eq("chemical_id", chemicalId)
    }

    const legacyResult = await legacyQuery
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) {
    return createDatabaseErrorResponse("chemical-containers.get", error, auth.context)
  }

  const normalized = (data ?? []).map((container) => {
    const { expired, warning } = computeExpiryFlags(
      container.expiry_date ? String(container.expiry_date) : null,
      container.status,
    )

    return {
      ...container,
      status: expired ? "expired" : container.status,
      expiry_warning: warning,
    }
  })

  return NextResponse.json(normalized)
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const body = (await req.json()) as CreateContainerBody
  const chemicalId = body.chemical_id?.trim()
  const barcode = body.barcode?.trim() || generateBarcode()
  const containerCode = body.container_code?.trim() || barcode
  const batchNumber = body.batch_number?.trim() || null
  const quantity = Number(body.quantity)
  const unit = body.unit?.trim()
  const location = body.location?.trim()
  const expiryDate = body.expiry_date?.trim() || null
  const openedAt = body.opened_at?.trim() || null
  const status = body.status ?? "available"

  if (
    !chemicalId ||
    !containerCode ||
    !unit ||
    !location ||
    Number.isNaN(quantity) ||
    quantity < 0
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  let chemicalResult = await auth.context.supabase
    .from("chemicals")
    .select("id")
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", chemicalId)
    .maybeSingle()

  if (chemicalResult.error && isMissingColumnError(chemicalResult.error, "chemicals.lab_id")) {
    chemicalResult = await auth.context.supabase
      .from("chemicals")
      .select("id")
      .eq("id", chemicalId)
      .maybeSingle()
  }

  const { data: chemical, error: chemicalError } = chemicalResult

  if (chemicalError || !chemical) {
    if (chemicalError) {
      return createDatabaseErrorResponse("chemical-containers.post.chemical", chemicalError, auth.context)
    }
    return NextResponse.json({ error: "Chemical not found in current lab" }, { status: 404 })
  }

  let result = await auth.context.supabase
    .from("chemical_containers")
    .insert({
      chemical_id: chemicalId,
      lab_id: auth.context.currentLabId,
      container_code: containerCode,
      barcode,
      batch_number: batchNumber,
      quantity,
      unit,
      location,
      expiry_date: expiryDate,
      opened_at: openedAt,
      status,
    })
    .select()
    .single()

  if (result.error && isMissingColumnError(result.error, "lab_id")) {
    result = await auth.context.supabase
      .from("chemical_containers")
      .insert({
        chemical_id: chemicalId,
        container_code: containerCode,
        barcode,
        batch_number: batchNumber,
        quantity,
        unit,
        location,
        expiry_date: expiryDate,
        opened_at: openedAt,
        status,
      })
      .select()
      .single()
  }

  const { data, error } = result

  if (error) {
    return createDatabaseErrorResponse("chemical-containers.post", error, auth.context)
  }

  const { warning } = computeExpiryFlags(
    data.expiry_date ? String(data.expiry_date) : null,
    data.status,
  )
  if (warning) {
    await notifyInventoryTeam(
      auth.context.currentLabId,
      "expiry_warning",
      `Container ${data.container_code} is expiring within 30 days.`,
    )
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const auth = await requireApiAuth(req, ["lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")?.trim()
  if (!id) {
    return NextResponse.json({ error: "Container id is required" }, { status: 400 })
  }

  const body = (await req.json()) as UpdateContainerBody

  const updatePayload: Record<string, unknown> = {}
  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity)
    if (Number.isNaN(quantity) || quantity < 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 })
    }
    updatePayload.quantity = quantity
  }
  if (body.location !== undefined) updatePayload.location = body.location.trim()
  if (body.expiry_date !== undefined) updatePayload.expiry_date = body.expiry_date || null
  if (body.opened_at !== undefined) updatePayload.opened_at = body.opened_at || null
  if (body.status !== undefined) updatePayload.status = body.status

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  let result = await auth.context.supabase
    .from("chemical_containers")
    .update(updatePayload)
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", id)
    .select()
    .single()

  if (result.error && isMissingColumnError(result.error, "chemical_containers.lab_id")) {
    result = await auth.context.supabase
      .from("chemical_containers")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()
  }

  const { data, error } = result

  if (error) {
    return createDatabaseErrorResponse("chemical-containers.patch", error, auth.context)
  }

  const { warning } = computeExpiryFlags(
    data.expiry_date ? String(data.expiry_date) : null,
    data.status,
  )
  if (warning) {
    await notifyInventoryTeam(
      auth.context.currentLabId,
      "expiry_warning",
      `Container ${data.container_code} is expiring within 30 days.`,
    )
  }

  return NextResponse.json(data)
}
