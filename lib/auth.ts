// Simple authentication for admin
const ADMIN_EMAIL = 'admin@admin.com'
const ADMIN_PASSWORD = 'Admin@Gharieni#123'

export function login(email: string, password: string): boolean {
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_authenticated', 'true')
      localStorage.setItem('admin_email', email)
    }
    return true
  }
  return false
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_authenticated')
    localStorage.removeItem('admin_email')
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('admin_authenticated') === 'true'
}

export function getAdminEmail(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('admin_email')
}
