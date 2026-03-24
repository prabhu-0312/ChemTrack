"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Flame,
  CircleAlert,
  Skull,
  AlertTriangle,
  HeartPulse,
  Leaf,
  Bomb,
  Wind,
  FlaskConical,
  MapPin,
  Thermometer,
  ShieldAlert,
  Ban,
  HardHat,
  User,
} from "lucide-react"
import { type Chemical, type HazardSymbol } from "@/lib/chemical-data"
import { cn } from "@/lib/utils"

interface ChemicalDetailModalProps {
  chemical: Chemical | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const hazardIcons: Record<HazardSymbol, { icon: typeof Flame; label: string; color: string }> = {
  flammable: { icon: Flame, label: "Flammable", color: "text-orange-500" },
  oxidizer: { icon: CircleAlert, label: "Oxidizer", color: "text-yellow-500" },
  corrosive: { icon: FlaskConical, label: "Corrosive", color: "text-red-500" },
  toxic: { icon: Skull, label: "Toxic", color: "text-purple-500" },
  irritant: { icon: AlertTriangle, label: "Irritant", color: "text-amber-500" },
  "health-hazard": { icon: HeartPulse, label: "Health Hazard", color: "text-rose-500" },
  environmental: { icon: Leaf, label: "Environmental Hazard", color: "text-green-600" },
  explosive: { icon: Bomb, label: "Explosive", color: "text-red-600" },
  "compressed-gas": { icon: Wind, label: "Compressed Gas", color: "text-blue-500" },
}

export function ChemicalDetailModal({ chemical, open, onOpenChange }: ChemicalDetailModalProps) {
  if (!chemical) return null

  const getStatusBadge = (status: Chemical["status"]) => {
    switch (status) {
      case "available":
        return <Badge className="bg-success/10 text-success border-success/20">In Stock</Badge>
      case "low":
        return <Badge className="bg-warning/10 text-warning-foreground border-warning/20">Low Stock</Badge>
      case "out":
        return <Badge variant="destructive">Out of Stock</Badge>
      case "in-use":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Currently In Use</Badge>
      case "expired":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-300">Expired</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                {chemical.name}
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-3">
                <code className="rounded bg-muted px-2 py-0.5 text-sm font-mono">
                  {chemical.formulaDisplay}
                </code>
                <span className="text-muted-foreground">CAS: {chemical.casNumber}</span>
              </DialogDescription>
            </div>
            {getStatusBadge(chemical.status)}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Hazard Symbols */}
          {chemical.hazardSymbols.length > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <h4 className="font-semibold text-destructive flex items-center gap-2 mb-3">
                <ShieldAlert className="h-4 w-4" />
                GHS Hazard Symbols
              </h4>
              <div className="flex flex-wrap gap-3">
                {chemical.hazardSymbols.map((symbol) => {
                  const hazard = hazardIcons[symbol]
                  const Icon = hazard.icon
                  return (
                    <div
                      key={symbol}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <Icon className={cn("h-5 w-5", hazard.color)} />
                      <span className="text-sm font-medium">{hazard.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Current User (if in use) */}
          {chemical.status === "in-use" && chemical.currentUser && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-medium">Currently being used by:</span>
                <span>{chemical.currentUser}</span>
              </div>
            </div>
          )}

          {/* Location & Storage */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <p className="font-medium">{chemical.location}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Thermometer className="h-4 w-4" />
                Storage Temperature
              </div>
              <p className="font-medium">{chemical.storageTemp || "Room temperature"}</p>
            </div>
          </div>

          {/* Quantity */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="font-semibold mb-2">Current Stock</h4>
            <p className="text-2xl font-bold text-primary">
              {chemical.quantity} <span className="text-base font-normal text-muted-foreground">{chemical.unit}</span>
            </p>
          </div>

          <Separator />

          {/* Safety Instructions */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Safety Instructions
            </h4>
            <ul className="space-y-2">
              {chemical.safetyInstructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                  {instruction}
                </li>
              ))}
            </ul>
          </div>

          {/* PPE Required */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <HardHat className="h-4 w-4 text-primary" />
              Required PPE
            </h4>
            <div className="flex flex-wrap gap-2">
              {chemical.ppeRequired.map((ppe) => (
                <Badge key={ppe} variant="secondary">
                  {ppe}
                </Badge>
              ))}
            </div>
          </div>

          {/* Incompatible Materials */}
          {chemical.incompatibleWith && chemical.incompatibleWith.length > 0 && (
            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-3">
                <Ban className="h-4 w-4 text-destructive" />
                Incompatible With
              </h4>
              <div className="flex flex-wrap gap-2">
                {chemical.incompatibleWith.map((material) => (
                  <Badge key={material} variant="outline" className="border-destructive/30 text-destructive">
                    {material}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
