"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, ClipboardCheck, PackageCheck, UserRoundCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Profile } from "@/types/profile"

type Lab = {
  id: string
  name: string
}

type LabsResponse = {
  current_lab_id: string | null
  labs: Lab[]
}

type BookingApproval = {
  id: string
  lab_id: string | null
  booking_date: string
  time_slot: string | null
  status: "pending" | "approved" | "rejected"
  labs?: {
    id: string
    name: string
  } | null
  requester?: {
    id: string
    name: string
    email: string
  } | null
}

type ApparatusApproval = {
  id: string
  apparatus_id: string
  lab_id: string
  booking_date: string
  time_slot: string
  status: "pending" | "approved" | "rejected"
  purpose: string | null
  apparatus?: {
    id: string
    name: string
    category: string
    location: string
    status: string
  } | null
  requester?: {
    id: string
    name: string
    email: string
    role: string
  } | null
}

export default function AdminApprovalsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [labs, setLabs] = useState<Lab[]>([])
  const [selectedLabId, setSelectedLabId] = useState("")
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [bookingRequests, setBookingRequests] = useState<BookingApproval[]>([])
  const [approvedBookings, setApprovedBookings] = useState<BookingApproval[]>([])
  const [apparatusRequests, setApparatusRequests] = useState<ApparatusApproval[]>([])
  const [approvedApparatusBookings, setApprovedApparatusBookings] = useState<ApparatusApproval[]>([])

  const loadApprovals = async (labId?: string) => {
    const labsResponse = await fetch("/api/labs", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    if (labsResponse.status === 403) {
      router.replace("/dashboard")
      return
    }

    const labsPayload = (await labsResponse.json()) as { error?: string } | LabsResponse
    if (!labsResponse.ok || !labsPayload || typeof labsPayload !== "object" || !Array.isArray((labsPayload as LabsResponse).labs)) {
      const message =
        "error" in (labsPayload as Record<string, unknown>) &&
        typeof (labsPayload as { error?: unknown }).error === "string"
          ? (labsPayload as { error: string }).error
          : "Unable to load labs"
      throw new Error(message)
    }

    const labData = labsPayload as LabsResponse
    const activeLabId = labId || selectedLabId || labData.current_lab_id || labData.labs[0]?.id || ""
    setLabs(labData.labs)
    setSelectedLabId(activeLabId)

    const query = activeLabId ? `?lab_id=${encodeURIComponent(activeLabId)}` : ""

    const [profilesResponse, bookingsResponse, approvedBookingsResponse, apparatusResponse, approvedApparatusResponse] =
      await Promise.all([
        fetch("/api/users?status=pending", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        fetch(`/api/bookings?status=pending${activeLabId ? `&lab_id=${encodeURIComponent(activeLabId)}` : ""}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        fetch(`/api/bookings?status=approved${activeLabId ? `&lab_id=${encodeURIComponent(activeLabId)}` : ""}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        fetch(`/api/apparatus-bookings?status=pending${query}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        fetch(`/api/apparatus-bookings?status=approved${query}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
      ])

    if (
      profilesResponse.status === 403 ||
      bookingsResponse.status === 403 ||
      approvedBookingsResponse.status === 403 ||
      apparatusResponse.status === 403 ||
      approvedApparatusResponse.status === 403
    ) {
      router.replace("/dashboard")
      return
    }

    const profilesPayload = (await profilesResponse.json()) as { error?: string } | Profile[]
    const bookingsPayload = (await bookingsResponse.json()) as { error?: string } | BookingApproval[]
    const approvedBookingsPayload = (await approvedBookingsResponse.json()) as { error?: string } | BookingApproval[]
    const apparatusPayload = (await apparatusResponse.json()) as { error?: string } | ApparatusApproval[]
    const approvedApparatusPayload = (await approvedApparatusResponse.json()) as { error?: string } | ApparatusApproval[]

    if (!profilesResponse.ok) {
      throw new Error("error" in profilesPayload ? profilesPayload.error ?? "Unable to load user approvals" : "Unable to load user approvals")
    }
    if (!bookingsResponse.ok) {
      throw new Error("error" in bookingsPayload ? bookingsPayload.error ?? "Unable to load booking approvals" : "Unable to load booking approvals")
    }
    if (!approvedBookingsResponse.ok) {
      throw new Error("error" in approvedBookingsPayload ? approvedBookingsPayload.error ?? "Unable to load approved bookings" : "Unable to load approved bookings")
    }
    if (!apparatusResponse.ok) {
      throw new Error("error" in apparatusPayload ? apparatusPayload.error ?? "Unable to load apparatus requests" : "Unable to load apparatus requests")
    }
    if (!approvedApparatusResponse.ok) {
      throw new Error(
        "error" in approvedApparatusPayload
          ? approvedApparatusPayload.error ?? "Unable to load approved apparatus bookings"
          : "Unable to load approved apparatus bookings",
      )
    }

    setProfiles(Array.isArray(profilesPayload) ? profilesPayload : [])
    setBookingRequests(Array.isArray(bookingsPayload) ? bookingsPayload : [])
    setApprovedBookings(Array.isArray(approvedBookingsPayload) ? approvedBookingsPayload : [])
    setApparatusRequests(Array.isArray(apparatusPayload) ? apparatusPayload : [])
    setApprovedApparatusBookings(Array.isArray(approvedApparatusPayload) ? approvedApparatusPayload : [])
  }

  useEffect(() => {
    loadApprovals()
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Unable to load approvals")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [router])

  const reloadCurrentLab = async () => {
    await loadApprovals(selectedLabId)
  }

  const updateUserStatus = async (id: string, status: "approved" | "rejected") => {
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ id, status }),
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error ?? "Unable to update user")
      return
    }

    toast.success(`User ${status}`)
    await reloadCurrentLab()
  }

  const updateBookingStatus = async (id: string, status: "approved" | "rejected") => {
    const response = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status }),
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error ?? "Unable to update booking request")
      return
    }

    toast.success(`Lab booking ${status}`)
    await reloadCurrentLab()
  }

  const deleteBooking = async (id: string) => {
    const response = await fetch(`/api/bookings/${id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error ?? "Unable to delete booking")
      return
    }

    toast.success("Lab booking deleted")
    await reloadCurrentLab()
  }

  const updateApparatusStatus = async (id: string, status: "approved" | "rejected") => {
    const response = await fetch(`/api/apparatus-bookings/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status }),
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error ?? "Unable to update apparatus request")
      return
    }

    toast.success(`Apparatus request ${status}`)
    await reloadCurrentLab()
  }

  const deleteApparatusBooking = async (id: string) => {
    const response = await fetch(`/api/apparatus-bookings/${id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error ?? "Unable to delete apparatus booking")
      return
    }

    toast.success("Apparatus booking deleted")
    await reloadCurrentLab()
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading approvals...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-muted-foreground">
          Review pending user signups plus lab and apparatus requests for the selected lab.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Lab Scope</CardTitle>
          <CardDescription>Switch labs to review the matching request queue.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm">
          <Select value={selectedLabId} onValueChange={(value) => void loadApprovals(value)}>
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
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserRoundCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{profiles.length}</p>
              <p className="text-sm text-muted-foreground">Pending Users</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CalendarClock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{bookingRequests.length}</p>
              <p className="text-sm text-muted-foreground">Pending Lab Bookings</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <PackageCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{apparatusRequests.length}</p>
              <p className="text-sm text-muted-foreground">Pending Apparatus Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ClipboardCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {approvedBookings.length + approvedApparatusBookings.length}
              </p>
              <p className="text-sm text-muted-foreground">Approved Reservations</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">User Approval Queue</CardTitle>
          </div>
          <CardDescription>Only lab managers can approve or reject account requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Department</TableHead>
                <TableHead className="text-muted-foreground">Role</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No pending users.
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((profile) => (
                  <TableRow key={profile.id} className="border-border">
                    <TableCell className="font-medium text-card-foreground">{profile.name}</TableCell>
                    <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                    <TableCell className="text-muted-foreground">{profile.department}</TableCell>
                    <TableCell className="text-card-foreground">{profile.role}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(profile.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => void updateUserStatus(profile.id, "rejected")}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => void updateUserStatus(profile.id, "approved")}>
                          Approve
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

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">Lab Booking Approval Queue</CardTitle>
          </div>
          <CardDescription>Approve a lab request to lock the slot for the selected lab.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Requester</TableHead>
                <TableHead className="text-muted-foreground">Lab</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Time Slot</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingRequests.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No pending lab booking requests.
                  </TableCell>
                </TableRow>
              ) : (
                bookingRequests.map((booking) => (
                  <TableRow key={booking.id} className="border-border">
                    <TableCell className="font-medium text-card-foreground">
                      {booking.requester?.name ?? "Unknown requester"}
                      <div className="text-sm font-normal text-muted-foreground">{booking.requester?.email ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-card-foreground">{booking.labs?.name ?? "Unknown lab"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(booking.booking_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground">{booking.time_slot ?? "Not set"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => void updateBookingStatus(booking.id, "rejected")}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => void updateBookingStatus(booking.id, "approved")}>
                          Approve
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

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">Apparatus Approval Queue</CardTitle>
          </div>
          <CardDescription>Approve apparatus requests so equipment slots cannot be double-booked.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Requester</TableHead>
                <TableHead className="text-muted-foreground">Apparatus</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Time Slot</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apparatusRequests.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No pending apparatus requests.
                  </TableCell>
                </TableRow>
              ) : (
                apparatusRequests.map((booking) => (
                  <TableRow key={booking.id} className="border-border">
                    <TableCell className="font-medium text-card-foreground">
                      {booking.requester?.name ?? "Unknown requester"}
                      <div className="text-sm font-normal text-muted-foreground">{booking.requester?.email ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-card-foreground">
                      {booking.apparatus?.name ?? "Unknown apparatus"}
                      <div className="text-sm text-muted-foreground">{booking.apparatus?.location ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(booking.booking_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground">{booking.time_slot}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => void updateApparatusStatus(booking.id, "rejected")}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => void updateApparatusStatus(booking.id, "approved")}>
                          Approve
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

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">Approved Apparatus Bookings</CardTitle>
          </div>
          <CardDescription>Delete an approved apparatus booking to free the equipment slot.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Requester</TableHead>
                <TableHead className="text-muted-foreground">Apparatus</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Time Slot</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvedApparatusBookings.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No approved apparatus bookings.
                  </TableCell>
                </TableRow>
              ) : (
                approvedApparatusBookings.map((booking) => (
                  <TableRow key={booking.id} className="border-border">
                    <TableCell className="font-medium text-card-foreground">
                      {booking.requester?.name ?? "Unknown requester"}
                    </TableCell>
                    <TableCell className="text-card-foreground">{booking.apparatus?.name ?? "Unknown apparatus"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(booking.booking_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground">{booking.time_slot}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => void deleteApparatusBooking(booking.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">Approved Lab Bookings</CardTitle>
          </div>
          <CardDescription>Delete an approved lab booking to free that lab slot.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Requester</TableHead>
                <TableHead className="text-muted-foreground">Lab</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Time Slot</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvedBookings.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No approved lab bookings.
                  </TableCell>
                </TableRow>
              ) : (
                approvedBookings.map((booking) => (
                  <TableRow key={booking.id} className="border-border">
                    <TableCell className="font-medium text-card-foreground">
                      {booking.requester?.name ?? "Unknown requester"}
                      <div className="text-sm font-normal text-muted-foreground">{booking.requester?.email ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-card-foreground">{booking.labs?.name ?? "Unknown lab"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(booking.booking_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground">{booking.time_slot ?? "Not set"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => void deleteBooking(booking.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
