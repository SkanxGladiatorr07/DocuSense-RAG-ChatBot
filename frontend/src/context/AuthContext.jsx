import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Run ONCE on mount to restore session from localStorage.
  // We deliberately do NOT put `token` in the dependency array —
  // that would re-fire the effect every time login/logout changes
  // the token and create an infinite loop / race condition.
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        try {
          const res = await api.get('/auth/me')
          // Backend wraps everything in { success, message, data: { user } }
          const userData = res.data?.data?.user || res.data?.user || res.data
          setUser(userData)
          setToken(storedToken)
        } catch (err) {
          // Token is invalid / expired – clear it
          console.warn('[AuthContext] Session restore failed:', err?.message || err)
          localStorage.removeItem('token')
          setToken(null)
          setUser(null)
        }
      }
      setIsLoading(false)
    }
    initAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // <-- empty deps: only runs once on mount

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    // Backend: { success, message, data: { token, user } }
    const data = res.data?.data || res.data
    const jwtToken = data.token
    const userData = data.user

    localStorage.setItem('token', jwtToken)
    setToken(jwtToken)
    setUser(userData)
    return data
  }

  const register = async (name, email, password) => {
    // Step 1: Create the account (register does NOT return a token)
    await api.post('/auth/register', { name, email, password })

    // Step 2: Immediately log in to get the JWT
    const loginRes = await api.post('/auth/login', { email, password })
    const data = loginRes.data?.data || loginRes.data
    const jwtToken = data.token
    const userData = data.user

    localStorage.setItem('token', jwtToken)
    setToken(jwtToken)
    setUser(userData)
    return data
  }

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  // Update user in context after profile save
  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
