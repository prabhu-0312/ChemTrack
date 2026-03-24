"use client"

import { useState } from "react"
import { AlertTriangle, FileText, FlaskConical, MapPin, Package } from "lucide-react"

import { ChemicalSearchInline } from "@/components/chemical-search"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type Chemical } from "@/lib/chemical-data"
import { cn } from "@/lib/utils"

export default function SearchPage() {
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null)

  const getStatusColor = (status: Chemical["status"]) => {
    switch (status) {
      case "available":
        return "bg-success/10 text-success border-success/20"
      case "low":
        return "bg-warning/10 text-warning-foreground border-warning/20"
      case "out":
        return "bg-destructive/10 text-destructive border-destructive/20"
    }
  }

  const getStatusLabel = (status: Chemical["status"]) => {
    switch (status) {
      case "available":
        return "In Stock"
      case "low":
        return "Low Stock"
      case "out":
        return "Out of Stock"
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Chemical Search</h1>
        <p className="text-muted-foreground">
          Search for chemicals by name, molecular formula, or CAS number
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Search Chemicals</CardTitle>
            <CardDescription>
              Start typing to search. Press Ctrl/Cmd+K anywhere to open quick search.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChemicalSearchInline onSelect={setSelectedChemical} />
          </CardContent>
        </Card>

        {selectedChemical ? (
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <FlaskConical className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-card-foreground">{selectedChemical.name}</CardTitle>
                    <code className="text-sm font-mono text-muted-foreground">
                      {selectedChemical.formulaDisplay}
                    </code>
                  </div>
                </div>
                <Badge variant="outline" className={cn(getStatusColor(selectedChemical.status))}>
                  {getStatusLabel(selectedChemical.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">CAS Number</p>
                      <p className="font-mono text-sm text-muted-foreground">
                        {selectedChemical.casNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">Location</p>
                      <p className="text-sm text-muted-foreground">{selectedChemical.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Package className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">Quantity</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedChemical.quantity} {selectedChemical.unit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">Hazard Class</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedChemical.hazardClass}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card">
            <CardContent className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FlaskConical className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">No chemical selected</p>
                <p className="text-sm text-muted-foreground">
                  Select a chemical from the search results to view details
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
