"use client"

import { useEffect, useMemo, useState } from "react"
import { Beaker, CalendarClock, Pencil, Plus, Search, Trash2, Wrench } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ApparatusStatus = "available" | "in_use" | "maintenance"

type ApparatusItem = {
  id: string
  lab_id: string
  name: string
  category: string
  location: string
  status: ApparatusStatus
  notes: string
  created_by: string
  created_at: string
}

type ApparatusBooking = {
  id: string
  apparatus_id: string
  lab_id: string
  booking_date: string
  time_slot: string
  purpose: string
  status: "pending" | "approved" | "rejected"
  apparatus?: {
    id: string
    name: string
  } | null
  requester?: {
    id: string
    name: string
    email: string
  } | null
}

type Lab = {
  id: string
  name: string
}

type LabsResponse = {
  current_lab_id: string | null
  viewer_role: "student" | "faculty" | "lab_assistant" | "lab_manager"
  viewer_user_id: string
  labs: Array<Lab & { joined_at?: string | null; member_role?: string | null }>
}

type ApparatusForm = {
  name: string
  category: string
  location: string
  status: ApparatusStatus
  notes: string
}

const initialForm: ApparatusForm = {
  name: "",
  category: "",
  location: "",
  status: "available",
  notes: "",
}

const timeSlots = ["08:00-10:00", "10:00-12:00", "12:00-14:00", "14:00-16:00", "16:00-18:00"]

function isLabsResponse(payload: unknown): payload is LabsResponse {
  if (!payload || typeof payload !== "object") return false
  return Array.isArray((payload as LabsResponse).labs)
}

function toDateOnly(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function ApparatusPage() {
  const [query, setQuery] = useState("")
  const [labs, setLabs] = useState<Lab[]>([])
  const [selectedLabId, setSelectedLabId] = useState("")
  const [viewerRole, setViewerRole] = useState<LabsResponse["viewer_role"] | null>(null)
  const [viewerUserId, setViewerUserId] = useState("")
  const [apparatus, setApparatus] = useState<ApparatusItem[]>([])
  const [bookings, setBookings] = useState<ApparatusBooking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ApparatusItem | null>(null)
  const [form, setForm] = useState<ApparatusForm>(initialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedApparatusId, setSelectedApparatusId] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("")
  const [bookingPurpose, setBookingPurpose] = useState("")
  const [isBooking, setIsBooking] = useState(false)

  const canManage = viewerRole === "lab_assistant" || viewerRole === "lab_manager"
  const canDelete = viewerRole === "lab_manager"
  const canRequestBooking = viewerRole === "faculty" || viewerRole === "lab_assistant" || viewerRole === "lab_manager"

  const loadLabs = async () => {
    const response = await fetch("/api/labs", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string } | LabsResponse
    if (!response.ok || !isLabsResponse(payload)) {
      throw new Error(
        !isLabsResponse(payload) && payload && typeof payload === "object" && "error" in payload
          ? payload.error ?? "Unable to load labs"
          : "Unable to load labs",
      )
    }

    setLabs(payload.labs)
    setViewerRole(payload.viewer_role)
    setViewerUserId(payload.viewer_user_id)
    setSelectedLabId((current) => current || payload.current_lab_id || payload.labs[0]?.id || "")
  }

  const loadApparatus = async (labId: string) => {
    if (!labId) {
      setApparatus([])
      return
    }

    const params = new URLSearchParams({ lab_id: labId })
    const response = await fetch(`/api/apparatus?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string } | ApparatusItem[]
    if (!response.ok) {
      throw new Error("error" in payload ? payload.error ?? "Unable to load apparatus" : "Unable to load apparatus")
    }

    setApparatus(Array.isArray(payload) ? payload : [])
  }

  const loadBookings = async (labId: string) => {
    if (!labId) {
      setBookings([])
      return
    }

    const params = new URLSearchParams({ lab_id: labId })
    const response = await fetch(`/api/apparatus-bookings?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string } | ApparatusBooking[]
    if (!response.ok) {
      throw new Error(
        "error" in payload ? payload.error ?? "Unable to load apparatus bookings" : "Unable to load apparatus bookings",
      )
    }

    setBookings(Array.isArray(payload) ? payload : [])
  }

  useEffect(() => {
    loadLabs()
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load labs"))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedLabId) return
    void Promise.all([loadApparatus(selectedLabId), loadBookings(selectedLabId)]).catch((error) =>
      toast.error(error instanceof Error ? error.message : "Unable to load apparatus data"),
    )
  }, [selectedLabId])

  const filteredApparatus = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return apparatus

    return apparatus.filter((item) =>
      [item.name, item.category, item.location, item.notes].some((field) =>
        field.toLowerCase().includes(normalizedQuery),
      ),
    )
  }, [apparatus, query])

  const ownBookings = useMemo(
    () => bookings.filter((booking) => booking.requester?.id === viewerUserId),
    [bookings, viewerUserId],
  )

  const openCreateDialog = () => {
    setEditingItem(null)
    setForm(initialForm)
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: ApparatusItem) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      category: item.category,
      location: item.location,
      status: item.status,
      notes: item.notes,
    })
    setIsDialogOpen(true)
  }

  const saveApparatus = async () => {
    if (!selectedLabId || !form.name.trim() || !form.category.trim() || !form.location.trim()) {
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(editingItem ? `/api/apparatus/${editingItem.id}` : "/api/apparatus", {
        method: editingItem ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          lab_id: selectedLabId,
          name: form.name.trim(),
          category: form.category.trim(),
          location: form.location.trim(),
          status: form.status,
          notes: form.notes.trim(),
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save apparatus")
      }

      toast.success(editingItem ? "Apparatus updated" : "Apparatus added")
      setIsDialogOpen(false)
      setEditingItem(null)
      setForm(initialForm)
      await loadApparatus(selectedLabId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save apparatus")
    } finally {
      setIsSaving(false)
    }
  }

  const deleteApparatus = async (id: string) => {
    const response = await fetch(`/api/apparatus/${id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error ?? "Unable to delete apparatus")
      return
    }

    toast.success("Apparatus deleted")
    await Promise.all([loadApparatus(selectedLabId), loadBookings(selectedLabId)])
  }

  const requestApparatusBooking = async () => {
    if (!selectedLabId || !selectedApparatusId || !selectedDate || !selectedTimeSlot) {
      return
    }

    setIsBooking(true)
    try {
      const response = await fetch("/api/apparatus-bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          lab_id: selectedLabId,
          apparatus_id: selectedApparatusId,
          booking_date: toDateOnly(selectedDate),
          time_slot: selectedTimeSlot,
          purpose: bookingPurpose.trim(),
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to request apparatus booking")
      }

      toast.success("Apparatus booking request sent")
      setSelectedApparatusId("")
      setSelectedDate(undefined)
      setSelectedTimeSlot("")
      setBookingPurpose("")
      await loadBookings(selectedLabId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request apparatus booking")
    } finally {
      setIsBooking(false)
    }
  }

  const cancelBooking = async (id: string) => {
    const response = await fetch(`/api/apparatus-bookings/${id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error ?? "Unable to cancel booking")
      return
    }

    toast.success("Apparatus booking cancelled")
    await loadBookings(selectedLabId)
  }

  const getStatusColor = (status: ApparatusStatus) => {
    switch (status) {
      case "available":
        return "bg-success/10 text-success border-success/20"
      case "in_use":
        return "bg-warning/10 text-warning-foreground border-warning/20"
      case "maintenance":
        return "bg-destructive/10 text-destructive border-destructive/20"
    }
  }

  const getStatusLabel = (status: ApparatusStatus) => {
    switch (status) {
      case "available":
        return "Available"
      case "in_use":
        return "In Use"
      case "maintenance":
        return "Maintenance"
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading apparatus...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Apparatus</h1>
          <p className="text-muted-foreground">
            Browse equipment, track availability, and request apparatus reservations.
          </p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search apparatus..."
              className="pl-9"
            />
          </div>

          {canManage ? (
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Beaker className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{apparatus.length}</p>
              <p className="text-sm text-muted-foreground">Total Apparatus</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <Beaker className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {apparatus.filter((item) => item.status === "available").length}
              </p>
              <p className="text-sm text-muted-foreground">Available</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <CalendarClock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {bookings.filter((item) => item.status === "approved").length}
              </p>
              <p className="text-sm text-muted-foreground">Approved Bookings</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Wrench className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {apparatus.filter((item) => item.status === "maintenance").length}
              </p>
              <p className="text-sm text-muted-foreground">Maintenance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border bg-card xl:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-card-foreground">Apparatus Register</CardTitle>
                <CardDescription>Visible to all approved users, backed by Supabase.</CardDescription>
              </div>

              <div className="w-full sm:w-72">
                <Label className="mb-2 block">Lab</Label>
                <Select value={selectedLabId} onValueChange={setSelectedLabId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a lab" />
                  </SelectTrigger>
                  <SelectContent>
                    {labs.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        {lab.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApparatus.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={canManage ? 6 : 5} className="py-8 text-center text-muted-foreground">
                      No apparatus found for this lab.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApparatus.map((item) => (
                    <TableRow key={item.id} className="border-border">
                      <TableCell className="font-medium text-card-foreground">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell className="text-muted-foreground">{item.location}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(getStatusColor(item.status))}>
                          {getStatusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.notes || "No notes"}</TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {canDelete ? (
                              <Button size="sm" variant="outline" onClick={() => void deleteApparatus(item.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Apparatus Booking</CardTitle>
            <CardDescription>
              {canRequestBooking ? "Send an apparatus booking request for manager approval." : "Students can view apparatus only."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Apparatus</Label>
              <Select value={selectedApparatusId} onValueChange={setSelectedApparatusId} disabled={!canRequestBooking}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose apparatus" />
                </SelectTrigger>
                <SelectContent>
                  {apparatus.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-md border" />
            </div>
            <div className="space-y-2">
              <Label>Time Slot</Label>
              <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot} disabled={!canRequestBooking}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose time slot" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Textarea
                value={bookingPurpose}
                onChange={(event) => setBookingPurpose(event.target.value)}
                disabled={!canRequestBooking}
                className="min-h-[90px]"
              />
            </div>
            {canRequestBooking ? (
              <Button className="w-full" disabled={isBooking} onClick={() => void requestApparatusBooking()}>
                {isBooking ? "Submitting..." : "Send Apparatus Request"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Your Apparatus Requests</CardTitle>
          <CardDescription>Track pending and approved apparatus reservations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Apparatus</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time Slot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ownBookings.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No apparatus booking requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                ownBookings.map((booking) => (
                  <TableRow key={booking.id} className="border-border">
                    <TableCell className="font-medium text-card-foreground">
                      {booking.apparatus?.name ?? "Unknown apparatus"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(booking.booking_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{booking.time_slot}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{booking.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {["pending", "approved"].includes(booking.status) ? (
                        <Button size="sm" variant="outline" onClick={() => void cancelBooking(booking.id)}>
                          Cancel
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Apparatus" : "Add Apparatus"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update apparatus details for this lab." : "Create a new apparatus record."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((current) => ({ ...current, status: value as ApparatusStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_use">In Use</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isSaving} onClick={() => void saveApparatus()}>
              {isSaving ? "Saving..." : editingItem ? "Save Changes" : "Add Apparatus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
