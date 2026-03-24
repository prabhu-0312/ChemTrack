"use client"

import { useState, useEffect } from "react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Search,
  FlaskConical,
  MapPin,
  Flame,
  AlertTriangle,
  Skull,
  HeartPulse,
  Leaf,
  CircleAlert,
  User,
} from "lucide-react"
import { searchChemicals, type Chemical, type HazardSymbol } from "@/lib/chemical-data"
import { ChemicalDetailModal } from "@/components/chemical-detail-modal"
import { cn } from "@/lib/utils"

interface ChemicalSearchProps {
  onSelect?: (chemical: Chemical) => void
  showDetailOnSelect?: boolean
}

const hazardIconMap: Record<HazardSymbol, typeof Flame> = {
  flammable: Flame,
  oxidizer: CircleAlert,
  corrosive: FlaskConical,
  toxic: Skull,
  irritant: AlertTriangle,
  "health-hazard": HeartPulse,
  environmental: Leaf,
  explosive: AlertTriangle,
  "compressed-gas": CircleAlert,
}

export function ChemicalSearch({ onSelect, showDetailOnSelect = true }: ChemicalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Chemical[]>([])
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      const data = await searchChemicals(query)
      if (active) setResults(data)
    })()
    return () => {
      active = false
    }
  }, [query])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleSelect = (chemical: Chemical) => {
    onSelect?.(chemical)
    setOpen(false)
    if (showDetailOnSelect) {
      setSelectedChemical(chemical)
      setDetailOpen(true)
    }
  }

  const getStatusColor = (status: Chemical["status"]) => {
    switch (status) {
      case "available":
        return "bg-success/10 text-success border-success/20"
      case "low":
        return "bg-warning/10 text-warning-foreground border-warning/20"
      case "out":
        return "bg-destructive/10 text-destructive border-destructive/20"
      case "in-use":
        return "bg-primary/10 text-primary border-primary/20"
      case "expired":
        return "bg-orange-100 text-orange-700 border-orange-300"
    }
  }

  const getStatusLabel = (chemical: Chemical) => {
    switch (chemical.status) {
      case "available":
        return `${chemical.quantity}${chemical.unit} in Stock`
      case "low":
        return `${chemical.quantity}${chemical.unit} - Low Stock`
      case "out":
        return "Out of Stock"
      case "in-use":
        return "Currently In Use"
      case "expired":
        return "Expired"
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="relative h-10 w-full justify-start bg-muted/50 text-sm text-muted-foreground sm:w-64 md:w-80"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search chemicals...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Chemical Search" description="Search for chemicals by name, formula, or CAS number">
        <CommandInput
          placeholder="Search by name, formula, or CAS number..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6">
              <FlaskConical className="h-10 w-10 text-muted-foreground/50" />
              <p>No chemicals found.</p>
              <p className="text-xs text-muted-foreground">
                Try searching by name, formula, or CAS number
              </p>
            </div>
          </CommandEmpty>
          <CommandGroup heading={`Results (${results.length})`}>
            {results.map((chemical) => (
              <CommandItem
                key={chemical.id}
                value={`${chemical.name} ${chemical.formula} ${chemical.casNumber}`}
                onSelect={() => handleSelect(chemical)}
                className="flex flex-col items-start gap-2 p-3"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <span className="font-medium">{chemical.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {chemical.formulaDisplay}
                    </code>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs shrink-0", getStatusColor(chemical.status))}
                  >
                    {getStatusLabel(chemical)}
                  </Badge>
                </div>
                <div className="flex w-full items-center justify-between gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="font-mono">CAS: {chemical.casNumber}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {chemical.location}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {chemical.hazardSymbols.slice(0, 3).map((symbol) => {
                      const Icon = hazardIconMap[symbol]
                      return (
                        <Icon
                          key={symbol}
                          className="h-3.5 w-3.5 text-destructive/70"
                        />
                      )
                    })}
                    {chemical.hazardSymbols.length > 3 && (
                      <span className="text-[10px]">+{chemical.hazardSymbols.length - 3}</span>
                    )}
                  </div>
                </div>
                {chemical.status === "in-use" && chemical.currentUser && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <User className="h-3 w-3" />
                    {chemical.currentUser}
                  </div>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <ChemicalDetailModal
        chemical={selectedChemical}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}

export function ChemicalSearchInline({ onSelect, showDetailOnSelect = true }: ChemicalSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Chemical[]>([])
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      const data = await searchChemicals(query)
      if (active) setResults(data)
    })()
    return () => {
      active = false
    }
  }, [query])

  const handleSelect = (chemical: Chemical) => {
    onSelect?.(chemical)
    if (showDetailOnSelect) {
      setSelectedChemical(chemical)
      setDetailOpen(true)
    }
  }

  const getStatusColor = (status: Chemical["status"]) => {
    switch (status) {
      case "available":
        return "bg-success/10 text-success border-success/20"
      case "low":
        return "bg-warning/10 text-warning-foreground border-warning/20"
      case "out":
        return "bg-destructive/10 text-destructive border-destructive/20"
      case "in-use":
        return "bg-primary/10 text-primary border-primary/20"
      case "expired":
        return "bg-orange-100 text-orange-700 border-orange-300"
    }
  }

  const getStatusLabel = (chemical: Chemical) => {
    switch (chemical.status) {
      case "available":
        return `${chemical.quantity}${chemical.unit} in Stock`
      case "low":
        return `${chemical.quantity}${chemical.unit} - Low Stock`
      case "out":
        return "Out of Stock"
      case "in-use":
        return "Currently In Use"
      case "expired":
        return "Expired"
    }
  }

  return (
    <>
      <Command className="rounded-lg border border-border shadow-md">
        <CommandInput
          placeholder="Search by name, formula, or CAS number..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6">
              <FlaskConical className="h-10 w-10 text-muted-foreground/50" />
              <p>No chemicals found.</p>
              <p className="text-xs text-muted-foreground">
                Try searching by name, formula, or CAS number
              </p>
            </div>
          </CommandEmpty>
          <CommandGroup heading={`Results (${results.length})`}>
            {results.map((chemical) => (
              <CommandItem
                key={chemical.id}
                value={`${chemical.name} ${chemical.formula} ${chemical.casNumber}`}
                onSelect={() => handleSelect(chemical)}
                className="flex flex-col items-start gap-2 p-3"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <span className="font-medium">{chemical.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {chemical.formulaDisplay}
                    </code>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs shrink-0", getStatusColor(chemical.status))}
                  >
                    {getStatusLabel(chemical)}
                  </Badge>
                </div>
                <div className="flex w-full items-center justify-between gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="font-mono">CAS: {chemical.casNumber}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {chemical.location}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {chemical.hazardSymbols.slice(0, 3).map((symbol) => {
                      const Icon = hazardIconMap[symbol]
                      return (
                        <Icon
                          key={symbol}
                          className="h-3.5 w-3.5 text-destructive/70"
                        />
                      )
                    })}
                  </div>
                </div>
                {chemical.status === "in-use" && chemical.currentUser && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <User className="h-3 w-3" />
                    {chemical.currentUser}
                  </div>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>

      <ChemicalDetailModal
        chemical={selectedChemical}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}
