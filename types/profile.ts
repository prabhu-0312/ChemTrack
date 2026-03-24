export type UserRole = "student" | "faculty" | "lab_assistant" | "lab_manager"

export type ApprovalStatus = "pending" | "approved" | "rejected"

export interface Profile {
  id: string
  name: string
  email: string
  department: string
  role: UserRole
  status: ApprovalStatus
  created_at: string
}
