/**
 * @file services/api.js
 * @description Axios instance pre-configured with the backend base URL.
 *              Import this instead of bare axios everywhere so the base
 *              URL is defined in one place.
 *
 * Usage:
 *   import api from '../services/api'
 *   const res = await api.get('/chat/history')
 */

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Request Interceptor ───────────────────────────────────────────────────────
// Attach auth token when available (uncomment when auth is implemented)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response Interceptor ──────────────────────────────────────────────────────
// Normalise error shape so consumers always get { message, status }
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || 'An unexpected error occurred.'
    const status = error.response?.status || 500
    return Promise.reject({ message, status })
  }
)

export default api
