import { NextResponse } from "next/server"

import {
  createDatabaseErrorResponse,
  isMissingColumnError,
  requireApiAuth,
} from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type LabRow = {
  id: string
  name: string
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const requestedLabId = searchParams.get("lab_id")?.trim() || null

  const { data: departmentLabs, error: labsError } = await supabaseAdmin
    .from("labs")
    .select("id, name")
    .eq("department", auth.context.profile.department)
    .order("created_at", { ascending: true })

  if (labsError) {
    return createDatabaseErrorResponse("activity.weekly.labs", labsError, auth.context)
  }

  const labs = (departmentLabs ?? []) as LabRow[]
  const allowedLabIds = labs.map((lab) => lab.id)
  const labId = requestedLabId || auth.context.currentLabId || allowedLabIds[0] || null

  if (!labId) {
    return NextResponse.json({ error: "No lab available" }, { status: 404 })
  }
  if (!allowedLabIds.includes(labId)) {
    return NextResponse.json({ error: "Forbidden for selected lab" }, { status: 403 })
  }

  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceIso = since.toISOString()

  const [{ data: bookings, error: bookingsError }, { data: transactions, error: transactionsError }] =
    await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("id, lab_id, user_id, booking_date, time_slot, status, created_at")
        .eq("lab_id", labId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("inventory_transactions")
        .select("id, lab_id, user_id, action, quantity_change, notes, created_at")
        .eq("lab_id", labId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false }),
    ])

  if (bookingsError) {
    return createDatabaseErrorResponse("activity.weekly.bookings", bookingsError, auth.context)
  }
  if (transactionsError) {
    if (!isMissingColumnError(transactionsError, "inventory_transactions.lab_id")) {
      return createDatabaseErrorResponse("activity.weekly.transactions", transactionsError, auth.context)
    }
  }

  let usageRows = transactions ?? []
  let compatibilityMode: "current" | "legacy-no-transaction-lab" = "current"

  if (transactionsError && isMissingColumnError(transactionsError, "inventory_transactions.lab_id")) {
    compatibilityMode = "legacy-no-transaction-lab"

    const { data: legacyTransactions, error: legacyTransactionsError } = await supabaseAdmin
      .from("inventory_transactions")
      .select("id, user_id, action, quantity_change, notes, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })

    if (legacyTransactionsError) {
      return createDatabaseErrorResponse(
        "activity.weekly.transactions.legacy",
        legacyTransactionsError,
        auth.context,
      )
    }

    usageRows = (legacyTransactions ?? []).map((transaction) => ({
      ...transaction,
      lab_id: labId,
    }))
  }

  const actorIds = [
    ...new Set(
      [...(bookings ?? []), ...usageRows]
        .map((row) => row.user_id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ]

  const { data: actors, error: actorsError } = actorIds.length
    ? await supabaseAdmin.from("profiles").select("id, name, email, role").in("id", actorIds)
    : { data: [], error: null }

  if (actorsError) {
    return createDatabaseErrorResponse("activity.weekly.actors", actorsError, auth.context)
  }

  const actorsById = new Map((actors ?? []).map((actor) => [actor.id, actor]))
  const selectedLab = labs.find((lab) => lab.id === labId) ?? null

  return NextResponse.json({
    lab: selectedLab,
    labs,
    since: sinceIso,
    compatibility_mode: compatibilityMode,
    bookings: (bookings ?? []).map((booking) => ({
      ...booking,
      actor: booking.user_id ? actorsById.get(booking.user_id) ?? null : null,
    })),
    usage: usageRows.map((transaction) => ({
      ...transaction,
      actor: transaction.user_id ? actorsById.get(transaction.user_id) ?? null : null,
    })),
  })
}
