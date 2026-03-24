export interface Chemical {
  id: string
  lab_id: string
  name: string
  formula: string
  hazard_level: string
  quantity: number
  location: string
  low_stock?: boolean
  low_stock_threshold?: number
  total_quantity?: number
  container_count?: number
  has_expired_containers?: boolean
  created_at: string
}

export type ChemicalHazardLevel = 'Low' | 'Medium' | 'High'

export type CreateChemicalInput = {
  name: string
  formula: string
  hazard_level: ChemicalHazardLevel
  quantity: number
  location: string
}

export type UpdateChemicalInput = Pick<
  CreateChemicalInput,
  'hazard_level' | 'quantity' | 'location'
>
