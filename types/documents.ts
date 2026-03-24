export type ChemicalDocumentType = "msds" | "safety_sheet" | "protocol"

export interface ChemicalDocument {
  id: string
  lab_id: string
  chemical_id: string
  document_type: ChemicalDocumentType
  file_url: string
  uploaded_by: string
  created_at: string
}
