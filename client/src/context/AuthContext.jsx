import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // WHY (Functionality): Initializing token from localStorage means the user stays
  // logged in after a page refresh. Without this, every reload wipes the token and
  // the user is silently logged out — even though their session should still be valid.
  // We read from localStorage on mount, and update it whenever the token changes.
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  // WHY (Code Style): Wrapping setToken so every token update also syncs to localStorage.
  // Keeping this in one place means login, register, and logout all stay consistent
  // without repeating localStorage calls in each function.
  const saveToken = (newToken) => {
    if (newToken) {
      localStorage.setItem('token', newToken)
    } else {
      localStorage.removeItem('token')
    }
    setToken(newToken)
  }

  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  const register = async (credentials) => {
    const response = await fetch(API + '/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    const body = await response.text()
    if (!response.ok) {
      throw new Error(body || 'Registration failed')
    }
    saveToken(body)
  }

  const login = async (credentials) => {
    const response = await fetch(API + '/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    const body = await response.text()
    if (!response.ok) {
      throw new Error(body || 'Login failed')
    }
    saveToken(body)
  }

  // WHY (Functionality): Passing null to saveToken clears localStorage as well,
  // so the user is fully logged out on all future page loads too.
  const logout = () => saveToken(null)

  const value = { token, register, login, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}