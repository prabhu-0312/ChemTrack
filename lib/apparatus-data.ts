export type ApparatusStatus = "available" | "in_use" | "maintenance"

export type ApparatusItem = {
  id: string
  name: string
  category: string
  location: string
  status: ApparatusStatus
  notes: string
}

export const apparatusCatalog: ApparatusItem[] = [
  {
    id: "rotary-1",
    name: "Rotary Evaporator #1",
    category: "Glassware",
    location: "Chemistry Lab 101",
    status: "available",
    notes: "Solvent removal and sample concentration",
  },
  {
    id: "rotary-2",
    name: "Rotary Evaporator #2",
    category: "Glassware",
    location: "Chemistry Lab 102",
    status: "available",
    notes: "Backup evaporator for overflow sessions",
  },
  {
    id: "spectro-1",
    name: "UV-Vis Spectrophotometer",
    category: "Analytical",
    location: "Analytical Lab 202",
    status: "available",
    notes: "Absorbance and concentration measurement",
  },
  {
    id: "centrifuge-1",
    name: "High-Speed Centrifuge",
    category: "Separation",
    location: "Chemistry Lab 201",
    status: "maintenance",
    notes: "Calibration scheduled this week",
  },
  {
    id: "fume-1",
    name: "Fume Hood A",
    category: "Safety",
    location: "Chemistry Lab 101",
    status: "available",
    notes: "Use for volatile solvents and acid work",
  },
  {
    id: "fume-2",
    name: "Fume Hood B",
    category: "Safety",
    location: "Chemistry Lab 102",
    status: "in_use",
    notes: "Reserved for current faculty session",
  },
]
