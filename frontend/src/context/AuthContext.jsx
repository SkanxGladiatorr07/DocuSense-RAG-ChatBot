import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me')
          setUser(res.data.user || res.data)
        } catch (err) {
          console.error('Session initialization failed:', err)
          logout()
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [token])

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password })
      const data = res.data
      const jwtToken = data.token
      localStorage.setItem('token', jwtToken)
      setToken(jwtToken)
      setUser(data.user)
      return data
    } catch (err) {
      throw err
    }
  }

  const register = async (name, email, password) => {
    try {
      const res = await api.post('/auth/register', { name, email, password })
      const data = res.data
      const jwtToken = data.token
      localStorage.setItem('token', jwtToken)
      setToken(jwtToken)
      setUser(data.user)
      return data
    } catch (err) {
      throw err
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
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
