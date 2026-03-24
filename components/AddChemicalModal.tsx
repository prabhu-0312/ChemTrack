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
import { CreateChemicalInput } from "@/types/chemical"

type AddChemicalModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => Promise<void> | void
}

const initialFormData: CreateChemicalInput = {
  name: '',
  formula: '',
  hazard_level: 'Low',
  quantity: 0,
  location: '',
}

export function AddChemicalModal({
  open,
  onOpenChange,
  onSuccess,
}: AddChemicalModalProps) {
  const [formData, setFormData] = useState<CreateChemicalInput>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setFormData(initialFormData)
      setIsSubmitting(false)
    }
  }, [open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/chemicals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? "Failed to add chemical")
      }

      toast.success("Chemical added successfully")
      setFormData(initialFormData)
      onOpenChange(false)
      await onSuccess()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to add chemical"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Chemical</DialogTitle>
          <DialogDescription>
            Enter chemical details to add it to inventory.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="add-name">Name</Label>
            <Input
              id="add-name"
              required
              value={formData.name}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-formula">Formula</Label>
            <Input
              id="add-formula"
              required
              value={formData.formula}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, formula: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Hazard Level</Label>
            <Select
              value={formData.hazard_level}
              onValueChange={(value: CreateChemicalInput['hazard_level']) =>
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
            <Label htmlFor="add-quantity">Quantity</Label>
            <Input
              id="add-quantity"
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
            <Label htmlFor="add-location">Location</Label>
            <Input
              id="add-location"
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Chemical"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
