import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { supabaseAdmin } from "@/lib/supabase-admin"
import { UserRole } from "@/types/profile"

type SignupBody = {
  name?: string
  email?: string
  password?: string
  department?: string
  role?: UserRole
}

type LabRow = {
  id: string
  name: string
  department: string
  created_by: string | null
  created_at: string
}

const allowedRoles: UserRole[] = ["student", "faculty", "lab_assistant", "lab_manager"]

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isAllowedSignupEmail(email: string): boolean {
  return email.endsWith("@vitstudent.ac.in")
}

async function findAuthUserByEmail(email: string) {
  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw error
    }

    const users = data.users ?? []
    const match = users.find((user) => user.email?.toLowerCase() === email)
    if (match) {
      return match
    }

    if (users.length < 200) {
      return null
    }

    page += 1
  }
}

async function removeStaleAuthUser(email: string) {
  const authUser = await findAuthUserByEmail(email)
  if (!authUser) return false

  const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("id", authUser.id).maybeSingle()
  if (profile) {
    return false
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(authUser.id)
  if (error) {
    throw error
  }

  return true
}

async function findDepartmentLab(department: string): Promise<LabRow | null> {
  const { data, error } = await supabaseAdmin
    .from("labs")
    .select("id, name, department, created_by, created_at")
    .eq("department", department)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as LabRow | null) ?? null
}

async function createDepartmentLab(department: string, createdBy: string): Promise<LabRow> {
  const { data, error } = await supabaseAdmin
    .from("labs")
    .insert({
      name: `${department} Main Lab`,
      department,
      created_by: createdBy,
    })
    .select("id, name, department, created_by, created_at")
    .single()

  if (error || !data) {
    throw error ?? new Error("Failed to create default lab.")
  }

  return data as LabRow
}

async function notifyLabManagers(labId: string, message: string) {
  const { data: managers } = await supabaseAdmin
    .from("lab_members")
    .select("user_id, profiles!inner(status)")
    .eq("lab_id", labId)
    .eq("role", "lab_manager")
    .eq("profiles.status", "approved")

  if (managers && managers.length > 0) {
    await supabaseAdmin.from("notifications").insert(
      managers.map((manager) => ({
        lab_id: labId,
        user_id: manager.user_id,
        type: "approval_pending",
        message,
      })),
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SignupBody

    const name = body.name?.trim()
    const email = body.email ? sanitizeEmail(body.email) : ""
    const password = body.password ?? ""
    const department = body.department?.trim()
    const role = body.role

    if (!name || !email || !password || !department || !role) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 })
    }

    if (!isAllowedSignupEmail(email)) {
      return NextResponse.json(
        { error: "Only @vitstudent.ac.in email addresses are allowed." },
        { status: 400 },
      )
    }

    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role selected." }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")
    const supabaseAnonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)

    const redirectTo = `${new URL(req.url).origin}/login`
    let signUpAttempt = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (
      signUpAttempt.error?.message?.toLowerCase().includes("already registered") ||
      signUpAttempt.error?.message?.toLowerCase().includes("user already registered")
    ) {
      const removedStaleUser = await removeStaleAuthUser(email)
      if (removedStaleUser) {
        signUpAttempt = await supabaseAuth.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
          },
        })
      }
    }

    const { data: signUpData, error: signUpError } = signUpAttempt

    if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    const userId = signUpData.user?.id
    if (!userId) {
      return NextResponse.json(
        { error: "Signup succeeded but no user id was returned." },
        { status: 500 },
      )
    }

    const status = role === "student" ? "approved" : "pending"
    const { error: profileInsertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        name,
        email,
        department,
        role,
        status,
        created_at: new Date().toISOString(),
      })

    if (profileInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileInsertError.message }, { status: 500 })
    }

    let targetLab = await findDepartmentLab(department)
    if (!targetLab) {
      targetLab = await createDepartmentLab(department, userId)
    }

    const { error: membershipError } = await supabaseAdmin
      .from("lab_members")
      .insert({
        lab_id: targetLab.id,
        user_id: userId,
        role,
      })

    if (membershipError) {
      await supabaseAdmin.from("profiles").delete().eq("id", userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    if (status === "pending") {
      await notifyLabManagers(
        targetLab.id,
        `New ${role} signup pending approval: ${name} (${email}).`,
      )
    }

    return NextResponse.json({
      success: true,
      message: "Signup successful. Check your email to confirm your account before signing in.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected signup error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
