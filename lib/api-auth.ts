import { NextResponse } from "next/server"

import { getAuthContext, type AuthContext } from "@/lib/auth"
import { UserRole } from "@/types/profile"

type AuthResult =
  | { ok: true; context: AuthContext }
  | { ok: false; response: NextResponse }

type DatabaseErrorLike = {
  message: string
  code?: string
  details?: string
  hint?: string
}

export async function requireApiAuth(
  _req: Request,
  allowedRoles?: UserRole[],
): Promise<AuthResult> {
  const auth = await getAuthContext()

  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (auth.profile.status !== "approved") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account not approved" }, { status: 403 }),
    }
  }

  if (allowedRoles && !allowedRoles.includes(auth.profile.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return {
    ok: true,
    context: auth,
  }
}

export function createDatabaseErrorResponse(
  scope: string,
  error: DatabaseErrorLike,
  context?: Pick<AuthContext, "userId" | "currentLabId">,
) {
  const isRlsFailure =
    error.code === "42501" ||
    error.message.toLowerCase().includes("row-level security") ||
    error.message.toLowerCase().includes("permission denied")

  return NextResponse.json(
    { error: error.message, rls: isRlsFailure || undefined },
    { status: isRlsFailure ? 403 : 500 },
  )
}

export function isMissingColumnError(error: DatabaseErrorLike, column: string) {
  return error.code === "42703" && error.message.toLowerCase().includes(column.toLowerCase())
}
