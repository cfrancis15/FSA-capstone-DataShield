import { createContext, useContext, useState } from 'react'

// Central auth state so any component can access token/login/register/logout.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)

  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  // Creates an account and stores returned token for authenticated requests.
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
    setToken(body)
  }

  // Logs in existing user and stores returned token.
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
    setToken(body)
  }

  // Clears token and returns app to logged-out state.
  const logout = () => setToken(null)

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