"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FlaskConical, Loader2, Mail, Lock, User, Building } from "lucide-react"
import { UserRole } from "@/types/profile"

const roleDescriptions: Record<UserRole, string> = {
  lab_manager: "Full access to inventory, bookings, approvals, and analytics",
  faculty: "Book labs and apparatus, search chemicals",
  lab_assistant: "Manage inventory and assist with lab operations",
  student: "View-only access to chemical search and safety info",
}

export default function SignupPage() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "" as UserRole | "",
    department: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.role) {
      toast.error("Please select a role")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          department: formData.department.trim(),
          role: formData.role,
        }),
      })

      const result = (await response.json()) as { error?: string; message?: string }

      if (!response.ok) {
        toast.error(result.error ?? "Signup failed")
        return
      }

      toast.success(result.message ?? "Signup successful. Please verify your email.")
      router.push("/login")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign up")
    } finally {
      setIsLoading(false)
    }
  }


  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <div className="lg:hidden flex justify-center mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <FlaskConical className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">ChemTrack</span>
        </Link>
      </div>

      <Card className="border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>
            Enter your details to get started with ChemTrack
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Dr. Jane Smith"
                  className="pl-10"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@university.edu"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => updateField("role", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lab_manager">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Lab Manager</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="faculty">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Faculty</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="lab_assistant">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Lab Assistant</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="student">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Student</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {formData.role && (
                <p className="text-xs text-muted-foreground">
                  {roleDescriptions[formData.role as UserRole]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="department"
                  placeholder="Chemistry Department"
                  className="pl-10"
                  value={formData.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-10"
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="pl-10"
                    value={formData.confirmPassword}
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading || !formData.role}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </>
  )
}
