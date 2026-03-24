"use client"

import { useEffect, useMemo, useState } from "react"
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { AddChemicalModal } from "@/components/AddChemicalModal"
import { EditChemicalModal } from "@/components/EditChemicalModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Chemical } from "@/types/chemical"

export default function InventoryPage() {

  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingChemical, setEditingChemical] = useState<Chemical | null>(null)

  const fetchChemicals = async () => {
    try {
      setIsLoading(true)

      const res = await fetch("/api/chemicals", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      })

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string }
        throw new Error(payload.error ?? "Failed to fetch chemicals")
      }

      const data = await res.json()
      const rows = Array.isArray(data) ? data : data.data
      setChemicals(rows ?? [])

    } catch (err) {
      toast.error("Unable to load inventory")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchChemicals()
  }, [])

  const filteredChemicals = useMemo(() => {
    const q = searchQuery.toLowerCase()

    if (!q) return chemicals

    return chemicals.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.formula.toLowerCase().includes(q)
    )

  }, [chemicals, searchQuery])

  const getHazardColor = (hazard: string) => {

    switch (hazard.toLowerCase()) {
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/30"

      case "medium":
        return "bg-warning/10 text-warning-foreground border-warning/30"

      default:
        return "bg-success/10 text-success border-success/30"
    }
  }

  const handleDelete = async (id: string) => {

    try {

      const res = await fetch(`/api/chemicals/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      })

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string }
        throw new Error(payload.error ?? "Delete failed")
      }

      toast.success("Chemical deleted")

      await fetchChemicals()

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            Manage and track all chemicals in the laboratory
          </p>
        </div>

        <div className="flex gap-2">

          <div className="relative w-64">

            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />

            <Input
              placeholder="Search chemicals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />

          </div>

          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Chemical
          </Button>

        </div>
      </div>


      {/* Table */}

      <Card>

        <CardHeader>

          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle>Chemical Inventory</CardTitle>
          </div>

          <CardDescription>
            Complete list of chemicals
          </CardDescription>

        </CardHeader>


        <CardContent>

          <Table>

            <TableHeader>

              <TableRow>

                <TableHead>Chemical</TableHead>
                <TableHead>Formula</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Hazard</TableHead>
                <TableHead className="text-right">Actions</TableHead>

              </TableRow>

            </TableHeader>


            <TableBody>

              {isLoading ? (

                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading inventory...
                  </TableCell>
                </TableRow>

              ) : filteredChemicals.length === 0 ? (

                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No chemicals found
                  </TableCell>
                </TableRow>

              ) : (

                filteredChemicals.map((chemical) => (

                  <TableRow key={chemical.id}>

                    <TableCell className="font-medium">
                      {chemical.name}
                    </TableCell>

                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        {chemical.formula}
                      </code>
                    </TableCell>

                    <TableCell>
                      {chemical.location}
                    </TableCell>

                    <TableCell>

                      {chemical.quantity}

                      {chemical.quantity < 10 && (
                        <Badge
                          variant="outline"
                          className="ml-2 bg-warning/10 text-warning-foreground"
                        >
                          Low
                        </Badge>
                      )}

                    </TableCell>

                    <TableCell>

                      <Badge
                        variant="outline"
                        className={cn(getHazardColor(chemical.hazard_level))}
                      >
                        {chemical.hazard_level}
                      </Badge>

                    </TableCell>


                    <TableCell className="text-right">

                      <div className="flex justify-end gap-2">

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingChemical(chemical)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>


                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(chemical.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                      </div>

                    </TableCell>

                  </TableRow>

                ))
              )}

            </TableBody>

          </Table>

        </CardContent>

      </Card>


      {/* Add Modal */}

      <AddChemicalModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSuccess={fetchChemicals}
      />


      {/* Edit Modal */}

      <EditChemicalModal
        open={Boolean(editingChemical)}
        onOpenChange={(open) => {
          if (!open) setEditingChemical(null)
        }}
        chemical={editingChemical}
        onSuccess={fetchChemicals}
      />

    </div>
  )
}
