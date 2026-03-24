import { supabase } from '@/lib/supabase'

export type Chemical = Record<string, unknown>
export type User = Record<string, unknown>
export type Booking = Record<string, unknown>

export async function getChemicals(): Promise<Chemical[]> {
  const { data, error } = await supabase.from('chemicals').select('*')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Chemical[]
}

export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('users').select('*')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as User[]
}

export async function getBookings(): Promise<Booking[]> {
  const { data, error } = await supabase.from('bookings').select('*')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Booking[]
}
