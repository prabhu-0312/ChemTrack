"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, FileText, Shield } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

type Lab = {
  id: string
  name: string
}

type LabsResponse = {
  current_lab_id: string | null
  viewer_role: "faculty" | "lab_assistant" | "lab_manager"
  viewer_user_id: string
  labs: Array<Lab & { joined_at?: string | null; member_role?: string | null }>
}

type Incident = {
  id: string
  lab_id: string
  category: "accident" | "spill" | "equipment_breakage" | "missing_item" | "near_miss" | "other"
  severity: "low" | "medium" | "high" | "critical"
  location: string
  description: string
  status: "open" | "under_review" | "resolved"
  created_at: string
  resolved_at: string | null
  lab?: Lab | null
  reporter?: {
    id: string
    name: string
    email: string
    role: string
  } | null
}

const incidentCategories: Array<{ value: Incident["category"]; label: string }> = [
  { value: "accident", label: "Accident" },
  { value: "spill", label: "Spill" },
  { value: "equipment_breakage", label: "Equipment Breakage" },
  { value: "missing_item", label: "Missing Item" },
  { value: "near_miss", label: "Near Miss" },
  { value: "other", label: "Other" },
]

const severityLevels: Array<{ value: Incident["severity"]; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
]

function isLabsResponse(payload: unknown): payload is LabsResponse {
  if (!payload || typeof payload !== "object") return false
  return Array.isArray((payload as LabsResponse).labs)
}

export default function SafetyPage() {
  const [labs, setLabs] = useState<Lab[]>([])
  const [selectedLabId, setSelectedLabId] = useState("")
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [category, setCategory] = useState<Incident["category"]>("spill")
  const [severity, setSeverity] = useState<Incident["severity"]>("low")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [viewerRole, setViewerRole] = useState<LabsResponse["viewer_role"] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canUpdateStatus = viewerRole === "lab_assistant" || viewerRole === "lab_manager"

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
    setSelectedLabId((current) => current || payload.current_lab_id || payload.labs[0]?.id || "")
  }

  const loadIncidents = async (labId: string) => {
    if (!labId) {
      setIncidents([])
      return
    }

    const params = new URLSearchParams({ lab_id: labId })
    const response = await fetch(`/api/incidents?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string } | Incident[]
    if (!response.ok) {
      throw new Error("error" in payload ? payload.error ?? "Unable to load incidents" : "Unable to load incidents")
    }

    setIncidents(Array.isArray(payload) ? payload : [])
  }

  useEffect(() => {
    loadLabs()
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load labs"))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedLabId) return
    void loadIncidents(selectedLabId).catch((error) =>
      toast.error(error instanceof Error ? error.message : "Unable to load incidents"),
    )
  }, [selectedLabId])

  const submitIncident = async () => {
    if (!selectedLabId || !location.trim() || !description.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          lab_id: selectedLabId,
          category,
          severity,
          location: location.trim(),
          description: description.trim(),
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to log incident")
      }

      toast.success("Incident logged")
      setLocation("")
      setDescription("")
      setCategory("spill")
      setSeverity("low")
      await loadIncidents(selectedLabId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to log incident")
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateStatus = async (incidentId: string, status: Incident["status"]) => {
    const response = await fetch(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status }),
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error ?? "Unable to update incident")
      return
    }

    toast.success("Incident updated")
    await loadIncidents(selectedLabId)
  }

  const summary = useMemo(() => {
    return {
      total: incidents.length,
      open: incidents.filter((incident) => incident.status === "open").length,
      reviewing: incidents.filter((incident) => incident.status === "under_review").length,
      resolved: incidents.filter((incident) => incident.status === "resolved").length,
    }
  }, [incidents])

  const getSeverityColor = (currentSeverity: Incident["severity"]) => {
    switch (currentSeverity) {
      case "low":
        return "bg-success/10 text-success border-success/20"
      case "medium":
        return "bg-warning/10 text-warning-foreground border-warning/20"
      case "high":
      case "critical":
        return "bg-destructive/10 text-destructive border-destructive/20"
    }
  }

  const getStatusColor = (status: Incident["status"]) => {
    switch (status) {
      case "resolved":
        return "bg-success/10 text-success border-success/20"
      case "under_review":
        return "bg-warning/10 text-warning-foreground border-warning/20"
      default:
        return "bg-destructive/10 text-destructive border-destructive/20"
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading incidents...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Incident Log</h1>
        <p className="text-muted-foreground">
          Report accidents, spills, missing items, and equipment breakage for follow-up.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{summary.total}</p>
              <p className="text-sm text-muted-foreground">Total Reports</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{summary.open}</p>
              <p className="text-sm text-muted-foreground">Open</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <Shield className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{summary.reviewing}</p>
              <p className="text-sm text-muted-foreground">Under Review</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{summary.resolved}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Report Incident</CardTitle>
            <CardDescription>Log a new issue so the lab team can act on it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Lab</Label>
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

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as Incident["category"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {incidentCategories.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(value) => setSeverity(value as Incident["severity"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose severity" />
                </SelectTrigger>
                <SelectContent>
                  {severityLevels.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Fume hood A / shelf / bench" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What happened and what needs to be checked?"
                className="min-h-[120px]"
              />
            </div>

            <Button className="w-full" disabled={isSubmitting} onClick={() => void submitIncident()}>
              {isSubmitting ? "Submitting..." : "Log Incident"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-card-foreground">Incident Register</CardTitle>
            <CardDescription>
              Visible to faculty, lab assistants, and lab managers. Students do not have access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No incidents logged for this lab.
                    </TableCell>
                  </TableRow>
                ) : (
                  incidents.map((incident) => (
                    <TableRow key={incident.id} className="border-border">
                      <TableCell className="text-card-foreground">
                        <div>
                          <p>{new Date(incident.created_at).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(incident.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-card-foreground">
                        {incident.category.replaceAll("_", " ")}
                        <p className="mt-1 text-xs text-muted-foreground">{incident.description}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{incident.location}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(getSeverityColor(incident.severity))}>
                          {incident.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(getStatusColor(incident.status))}>
                          {incident.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {incident.reporter?.name ?? "Unknown reporter"}
                      </TableCell>
                      <TableCell className="text-right">
                        {canUpdateStatus ? (
                          <Select
                            value={incident.status}
                            onValueChange={(value) => void updateStatus(incident.id, value as Incident["status"])}
                          >
                            <SelectTrigger className="ml-auto w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="under_review">Under Review</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-muted-foreground">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
