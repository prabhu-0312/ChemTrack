export type HazardSymbol =
  | "flammable"
  | "oxidizer"
  | "corrosive"
  | "toxic"
  | "irritant"
  | "health-hazard"
  | "environmental"
  | "explosive"
  | "compressed-gas"

export interface Chemical {
  id: string
  name: string
  formula: string
  formulaDisplay: string
  casNumber: string
  location: string
  quantity: number
  unit: string
  hazardClass: string
  hazardSymbols: HazardSymbol[]
  status: "available" | "low" | "out" | "in-use" | "expired"
  storageTemp?: string
  safetyInstructions: string[]
  incompatibleWith?: string[]
  ppeRequired: string[]
  currentUser?: string
  low_stock?: boolean
}

type ChemicalsApiItem = {
  id: string
  name: string
  formula: string
  cas_number?: string | null
  hazard_level: string
  location: string | null
  total_quantity: number
  low_stock: boolean
}

type ChemicalsApiResponse = {
  data: ChemicalsApiItem[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

function mapHazardSymbols(hazardLevel: string): HazardSymbol[] {
  const normalized = hazardLevel.toLowerCase()
  if (normalized === "high") return ["toxic", "corrosive", "health-hazard"]
  if (normalized === "medium") return ["irritant", "flammable"]
  return ["irritant"]
}

function mapHazardClass(hazardLevel: string): string {
  const normalized = hazardLevel.toLowerCase()
  if (normalized === "high") return "High Hazard Chemical"
  if (normalized === "medium") return "Moderate Hazard Chemical"
  return "Low Hazard Chemical"
}

function toChemical(item: ChemicalsApiItem): Chemical {
  const quantity = Number(item.total_quantity ?? 0)
  const lowStock = Boolean(item.low_stock)

  let status: Chemical["status"] = "available"
  if (quantity <= 0) status = "out"
  else if (lowStock) status = "low"

  return {
    id: item.id,
    name: item.name,
    formula: item.formula,
    formulaDisplay: item.formula,
    casNumber: item.cas_number?.trim() || "N/A",
    location: item.location ?? "Unassigned",
    quantity,
    unit: "units",
    hazardClass: mapHazardClass(item.hazard_level),
    hazardSymbols: mapHazardSymbols(item.hazard_level),
    status,
    storageTemp: "Room temperature",
    safetyInstructions: ["Refer to MSDS before handling."],
    incompatibleWith: [],
    ppeRequired: ["Safety goggles", "Lab coat", "Nitrile gloves"],
    low_stock: lowStock,
  }
}

type SearchOptions = {
  hazard?: string
  page?: number
  pageSize?: number
}

export async function searchChemicals(
  query: string,
  options: SearchOptions = {},
): Promise<Chemical[]> {
  const params = new URLSearchParams()
  if (query.trim()) params.set("search", query.trim())
  if (options.hazard) params.set("hazard", options.hazard)
  params.set("page", String(options.page ?? 1))
  params.set("page_size", String(options.pageSize ?? 20))

  const response = await fetch(`/api/chemicals?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    return []
  }

  const payload = (await response.json()) as ChemicalsApiResponse | ChemicalsApiItem[]
  const rows = Array.isArray(payload) ? payload : payload.data
  return rows.map(toChemical)
}

export async function getChemicalById(id: string): Promise<Chemical | undefined> {
  const results = await searchChemicals(id, { page: 1, pageSize: 1 })
  return results.find((chemical) => chemical.id === id)
}

export async function getChemicalsByStatus(
  status: Chemical["status"],
): Promise<Chemical[]> {
  const results = await searchChemicals("", { page: 1, pageSize: 100 })
  return results.filter((chemical) => chemical.status === status)
}

export async function getLowStockChemicals(): Promise<Chemical[]> {
  const results = await searchChemicals("", { page: 1, pageSize: 100 })
  return results.filter((chemical) => chemical.status === "low" || chemical.status === "out")
}
