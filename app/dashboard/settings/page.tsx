import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Settings, Bell, Shield, Palette, Globe } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Configure your ChemTrack preferences and system settings
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <CardTitle className="text-card-foreground">General Settings</CardTitle>
            </div>
            <CardDescription>
              Basic configuration options for your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="labName" className="text-card-foreground">Laboratory Name</Label>
                <Input id="labName" defaultValue="University Chemistry Department" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-card-foreground">Timezone</Label>
                <Input id="timezone" defaultValue="America/New_York" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-card-foreground">Notifications</CardTitle>
            </div>
            <CardDescription>
              Manage how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-card-foreground">Low Stock Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications when chemicals are running low
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-card-foreground">Booking Requests</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when new booking requests are submitted
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-card-foreground">Safety Incidents</Label>
                <p className="text-sm text-muted-foreground">
                  Immediate alerts for safety-related events
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-card-foreground">Email Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Weekly summary of lab activities and statistics
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-card-foreground">Safety Thresholds</CardTitle>
            </div>
            <CardDescription>
              Configure inventory and safety alert thresholds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lowStock" className="text-card-foreground">Low Stock Warning (%)</Label>
                <Input id="lowStock" type="number" defaultValue="20" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="criticalStock" className="text-card-foreground">Critical Stock Warning (%)</Label>
                <Input id="criticalStock" type="number" defaultValue="10" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  )
}
