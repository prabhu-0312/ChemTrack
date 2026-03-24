import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type CreateTransactionBody = {
  container_id?: string
  action?: "add" | "consume" | "adjust" | "dispose"
  quantity_change?: number | string
  notes?: string
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { context } = auth
  const isManagerOrAssistant =
    context.profile.role === "lab_manager" || context.profile.role === "lab_assistant"

  let query = context.supabase
    .from("inventory_transactions")
    .select("*")
    .eq("lab_id", auth.context.currentLabId)
    .order("created_at", { ascending: false })

  if (!isManagerOrAssistant) {
    query = query.eq("user_id", context.userId)
  }

  const { data, error } = await query
  if (error) {
    return createDatabaseErrorResponse("inventory-transactions.get", error, auth.context)
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["faculty", "lab_assistant", "lab_manager"])
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { context } = auth
  const body = (await req.json()) as CreateTransactionBody
  const containerId = body.container_id?.trim()
  const action = body.action
  const quantityChange = Number(body.quantity_change)
  const notes = body.notes?.trim() || null

  if (!containerId || !action || Number.isNaN(quantityChange) || quantityChange === 0) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (context.profile.role === "faculty" && action !== "consume") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: container, error: containerError } = await context.supabase
    .from("chemical_containers")
    .select("id,chemical_id,container_code,quantity,status,expiry_date")
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", containerId)
    .maybeSingle()

  if (containerError || !container) {
    if (containerError) {
      return createDatabaseErrorResponse("inventory-transactions.post.container", containerError, auth.context)
    }
    return NextResponse.json({ error: "Container not found" }, { status: 404 })
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const isExpired =
    Boolean(container.expiry_date) &&
    String(container.expiry_date).slice(0, 10) < todayIso &&
    container.status !== "disposed"

  if (isExpired || container.status === "expired") {
    return NextResponse.json({ error: "Expired containers cannot be used." }, { status: 400 })
  }
  if (container.status === "disposed") {
    return NextResponse.json({ error: "Disposed containers cannot be used." }, { status: 400 })
  }

  let nextQuantity = Number(container.quantity)
  let nextStatus = container.status

  if (action === "consume") {
    if (quantityChange <= 0) {
      return NextResponse.json({ error: "Consumption must be positive" }, { status: 400 })
    }
    nextQuantity = Math.max(0, nextQuantity - quantityChange)
    if (nextQuantity === 0) nextStatus = "empty"
  } else if (action === "add") {
    nextQuantity = nextQuantity + Math.abs(quantityChange)
    if (nextQuantity > 0 && nextStatus === "empty") nextStatus = "available"
  } else if (action === "adjust") {
    nextQuantity = Math.max(0, nextQuantity + quantityChange)
    if (nextQuantity === 0) nextStatus = "empty"
    if (nextQuantity > 0 && nextStatus === "empty") nextStatus = "available"
  } else if (action === "dispose") {
    nextQuantity = 0
    nextStatus = "disposed"
  }

  const { error: updateError } = await context.supabase
    .from("chemical_containers")
    .update({
      quantity: nextQuantity,
      status: nextStatus,
    })
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", containerId)

  if (updateError) {
    return createDatabaseErrorResponse("inventory-transactions.post.container-update", updateError, auth.context)
  }

  const { data, error } = await context.supabase
    .from("inventory_transactions")
    .insert({
      lab_id: auth.context.currentLabId,
      container_id: containerId,
      user_id: context.userId,
      action,
      quantity_change: quantityChange,
      notes,
    })
    .select()
    .single()

  if (error) {
    return createDatabaseErrorResponse("inventory-transactions.post.insert", error, auth.context)
  }

  const { data: chemical } = await context.supabase
    .from("chemicals")
    .select("id,name,low_stock_threshold")
    .eq("lab_id", auth.context.currentLabId)
    .eq("id", container.chemical_id)
    .maybeSingle()

  if (chemical) {
    const { data: relatedContainers } = await context.supabase
      .from("chemical_containers")
      .select("quantity,status,expiry_date")
      .eq("lab_id", auth.context.currentLabId)
      .eq("chemical_id", chemical.id)

    const todayIso = new Date().toISOString().slice(0, 10)
    const totalAvailable =
      (relatedContainers ?? [])
        .filter((c) => {
          const expired =
            Boolean(c.expiry_date) &&
            String(c.expiry_date).slice(0, 10) < todayIso &&
            c.status !== "disposed"
          return c.status === "available" && !expired
        })
        .reduce((sum, c) => sum + Number(c.quantity || 0), 0)

    const threshold = Number(chemical.low_stock_threshold ?? 10)
    if (totalAvailable < threshold) {
      const { data: recipients } = await supabaseAdmin
        .from("lab_members")
        .select("user_id, profiles!inner(status)")
        .eq("lab_id", auth.context.currentLabId)
        .in("role", ["lab_assistant", "lab_manager"])
        .eq("profiles.status", "approved")

      if (recipients && recipients.length > 0) {
        await supabaseAdmin.from("notifications").insert(
          recipients.map((member) => ({
            lab_id: auth.context.currentLabId,
            user_id: member.user_id,
            type: "low_stock",
            message: `Low stock alert: ${chemical.name} total available quantity is ${totalAvailable}.`,
          })),
        )
      }
    }
  }

  return NextResponse.json(data, { status: 201 })
}
