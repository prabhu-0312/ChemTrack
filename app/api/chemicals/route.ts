import { NextResponse } from "next/server"

import {
  createDatabaseErrorResponse,
  isMissingColumnError,
  requireApiAuth,
} from "@/lib/api-auth"

type CreateChemicalBody = {
  name?: string
  formula?: string
  hazard_level?: 'Low' | 'Medium' | 'High'
  quantity?: number | string
  location?: string
  low_stock_threshold?: number | string
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req)
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")?.trim() ?? ""
  const hazard = searchParams.get("hazard")?.trim()
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("page_size") ?? "20")))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = auth.context.supabase
    .from("chemicals")
    .select("id,name,formula,cas_number,hazard_level,location,quantity,created_at,low_stock_threshold", {
      count: "exact",
    })
    .eq("lab_id", auth.context.currentLabId)
    .range(from, to)
    .order("created_at", { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,formula.ilike.%${search}%,cas_number.ilike.%${search}%`)
  }
  if (hazard) {
    query = query.eq("hazard_level", hazard)
  }

  let { data: chemicals, error, count } = await query

  if (error && isMissingColumnError(error, "chemicals.lab_id")) {
    let legacyQuery = auth.context.supabase
      .from("chemicals")
      .select("id,name,formula,cas_number,hazard_level,location,quantity,created_at,low_stock_threshold", {
        count: "exact",
      })
      .range(from, to)
      .order("created_at", { ascending: false })

    if (search) {
      legacyQuery = legacyQuery.or(`name.ilike.%${search}%,formula.ilike.%${search}%,cas_number.ilike.%${search}%`)
    }
    if (hazard) {
      legacyQuery = legacyQuery.eq("hazard_level", hazard)
    }

    const legacyResult = await legacyQuery
    chemicals = legacyResult.data
    error = legacyResult.error
    count = legacyResult.count
  }

  if (error) {
    return createDatabaseErrorResponse("chemicals.get", error, auth.context)
  }

  const chemicalIds = (chemicals ?? []).map((chemical) => chemical.id)

  let containers: Array<{
    chemical_id: string
    quantity: number
    status: string
    expiry_date: string | null
    location: string | null
  }> = []

  if (chemicalIds.length > 0) {
    let containerResult = await auth.context.supabase
      .from("chemical_containers")
      .select("chemical_id,quantity,status,expiry_date,location")
      .eq("lab_id", auth.context.currentLabId)
      .in("chemical_id", chemicalIds)

    if (containerResult.error && isMissingColumnError(containerResult.error, "chemical_containers.lab_id")) {
      containerResult = await auth.context.supabase
        .from("chemical_containers")
        .select("chemical_id,quantity,status,expiry_date,location")
        .in("chemical_id", chemicalIds)
    }

    const { data: containerRows, error: containerError } = containerResult

    if (containerError) {
      return createDatabaseErrorResponse("chemicals.get.containers", containerError, auth.context)
    }

    containers = containerRows ?? []
  }

  const todayIso = new Date().toISOString().slice(0, 10)

  const enriched = (chemicals ?? []).map((chemical) => {
    const related = containers.filter((container) => container.chemical_id === chemical.id)

    const effectiveContainers = related.map((container) => {
      const isExpired =
        Boolean(container.expiry_date) && container.expiry_date!.slice(0, 10) < todayIso
      const effectiveStatus = isExpired ? "expired" : container.status
      return {
        ...container,
        effective_status: effectiveStatus,
      }
    })

    const availableContainers = effectiveContainers.filter(
      (container) => container.effective_status === "available",
    )

    const totalQuantity =
      availableContainers.length > 0
        ? availableContainers.reduce((sum, container) => sum + Number(container.quantity || 0), 0)
        : Number(chemical.quantity ?? 0)

    const threshold = Number(chemical.low_stock_threshold ?? 10)
    const lowStock = totalQuantity < threshold
    const hasExpiredContainers = effectiveContainers.some(
      (container) => container.effective_status === "expired",
    )

    return {
      ...chemical,
      quantity: totalQuantity,
      total_quantity: totalQuantity,
      low_stock: lowStock,
      has_expired_containers: hasExpiredContainers,
      container_count: related.length,
      location:
        availableContainers.find((container) => container.location)?.location ??
        chemical.location,
    }
  })

  return NextResponse.json({
    data: enriched,
    pagination: {
      page,
      page_size: pageSize,
      total: count ?? enriched.length,
      total_pages: Math.max(1, Math.ceil((count ?? enriched.length) / pageSize)),
    },
  })
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ["lab_manager"])
  if (!auth.ok) return auth.response
  if (!auth.context.currentLabId) {
    return NextResponse.json({ error: "No lab membership found" }, { status: 403 })
  }

  const body = (await req.json()) as CreateChemicalBody
  const name = body.name?.trim()
  const formula = body.formula?.trim()
  const hazardLevel = body.hazard_level
  const location = body.location?.trim()
  const quantity = Number(body.quantity)
  const lowStockThreshold = Number(body.low_stock_threshold ?? 10)

  if (
    !name ||
    !formula ||
    !hazardLevel ||
    !location ||
    Number.isNaN(quantity) ||
    Number.isNaN(lowStockThreshold)
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  let result = await auth.context.supabase
    .from("chemicals")
    .insert([
      {
        name,
        formula,
        hazard_level: hazardLevel,
        quantity,
        location,
        low_stock_threshold: lowStockThreshold,
        lab_id: auth.context.currentLabId,
      },
    ])
    .select()
    .single()

  if (result.error && isMissingColumnError(result.error, "lab_id")) {
    result = await auth.context.supabase
      .from("chemicals")
      .insert([
        {
          name,
          formula,
          hazard_level: hazardLevel,
          quantity,
          location,
          low_stock_threshold: lowStockThreshold,
        },
      ])
      .select()
      .single()
  }

  const { data, error } = result

  if (error) {
    return createDatabaseErrorResponse("chemicals.post", error, auth.context)
  }

  return NextResponse.json(data, { status: 201 })
}
