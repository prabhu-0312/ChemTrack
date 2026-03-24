export type ContainerStatus = "available" | "empty" | "expired" | "disposed"

export interface ChemicalContainer {
  id: string
  lab_id: string
  chemical_id: string
  container_code: string
  barcode: string
  batch_number: string | null
  quantity: number
  unit: string
  location: string
  expiry_date: string | null
  opened_at: string | null
  status: ContainerStatus
  expiry_warning?: boolean
  created_at: string
}

export type InventoryAction = "add" | "consume" | "adjust" | "dispose"

export interface InventoryTransaction {
  id: string
  lab_id: string
  container_id: string
  user_id: string
  action: InventoryAction
  quantity_change: number
  notes: string | null
  created_at: string
}
