import { Routes, Route } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout.jsx'
import Home from '../pages/Home.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import Profile from '../pages/Profile.jsx'
import NotFound from '../pages/NotFound.jsx'
import Login from '../pages/Login.jsx'
import Register from '../pages/Register.jsx'
import ProtectedRoute from '../components/ProtectedRoute.jsx'

/**
 * AppRoutes.jsx
 * Central route registry.
 * All page-level routes are declared here.
 * Wrap routes inside MainLayout to share the Navbar across pages.
 */
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Routes wrapped in the shared MainLayout (Navbar + main content area) */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default AppRoutes
