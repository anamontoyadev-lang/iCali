import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://rkejcjfczpatvgirgyza.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZWpjamZjenBhdHZnaXJneXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMDczNjMsImV4cCI6MjA5MzU4MzM2M30.lHTAxwiougaVQHHB8cozpizDv8pdQhydaisTeUbdkNs',
  { auth: { persistSession: true, autoRefreshToken: true } }
)
