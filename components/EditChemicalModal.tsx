"use client"

import { FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Chemical, UpdateChemicalInput } from "@/types/chemical"

type EditChemicalModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  chemical: Chemical | null
  onSuccess: () => Promise<void> | void
}

const defaultForm: UpdateChemicalInput = {
  hazard_level: 'Low',
  quantity: 0,
  location: '',
}

const normalizeHazardLevel = (
  value: string,
): UpdateChemicalInput['hazard_level'] => {
  const normalized = value.toLowerCase()
  if (normalized === 'high') return 'High'
  if (normalized === 'medium') return 'Medium'
  return 'Low'
}

export function EditChemicalModal({
  open,
  onOpenChange,
  chemical,
  onSuccess,
}: EditChemicalModalProps) {
  const [formData, setFormData] = useState<UpdateChemicalInput>(defaultForm)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !chemical) {
      setFormData(defaultForm)
      setIsSubmitting(false)
      return
    }

    setFormData({
      hazard_level: normalizeHazardLevel(chemical.hazard_level),
      quantity: chemical.quantity,
      location: chemical.location,
    })
  }, [chemical, open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!chemical) return
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/chemicals/${chemical.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? "Failed to update chemical")
      }

      toast.success("Chemical updated successfully")
      onOpenChange(false)
      await onSuccess()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update chemical"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Chemical</DialogTitle>
          <DialogDescription>
            Update quantity, location, and hazard level.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Chemical</Label>
            <Input value={chemical?.name ?? ''} disabled />
          </div>

          <div className="space-y-2">
            <Label>Hazard Level</Label>
            <Select
              value={formData.hazard_level}
              onValueChange={(value: UpdateChemicalInput['hazard_level']) =>
                setFormData((prev) => ({ ...prev, hazard_level: value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select hazard level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-quantity">Quantity</Label>
            <Input
              id="edit-quantity"
              type="number"
              min={0}
              required
              value={formData.quantity}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  quantity: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location">Location</Label>
            <Input
              id="edit-location"
              required
              value={formData.location}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, location: event.target.value }))
              }
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !chemical}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
