import { NextResponse } from "next/server"

import { createDatabaseErrorResponse, requireApiAuth } from "@/lib/api-auth"

function computeExpiryWarning(expiryDate: string | null, status: string): boolean {
  if (!expiryDate || status === "disposed") return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)

  const daysRemaining = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return daysRemaining >= 0 && daysRemaining < 30
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const barcode = searchParams.get("barcode")?.trim()
  if (!barcode) {
    return NextResponse.json({ error: "barcode is required" }, { status: 400 })
  }

  const { data, error } = await auth.context.supabase
    .from("chemical_containers")
    .select("*, chemicals(id,name,formula,hazard_level)")
    .eq("lab_id", auth.context.currentLabId)
    .eq("barcode", barcode)
    .maybeSingle()

  if (error) {
    return createDatabaseErrorResponse("containers.by-barcode.get", error, auth.context)
  }
  if (!data) {
    return NextResponse.json({ error: "Container not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...data,
    expiry_warning: computeExpiryWarning(
      data.expiry_date ? String(data.expiry_date) : null,
      data.status,
    ),
  })
}
