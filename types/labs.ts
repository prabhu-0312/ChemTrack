export type LabRole = "student" | "faculty" | "lab_assistant" | "lab_manager"

export interface Lab {
  id: string
  name: string
  department: string
  created_by: string | null
  created_at: string
}

export interface LabMember {
  id: string
  lab_id: string
  user_id: string
  role: LabRole
  joined_at: string
}
