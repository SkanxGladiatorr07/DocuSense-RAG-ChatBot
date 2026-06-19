import { Routes, Route } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout.jsx'
import Home from '../pages/Home.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import NotFound from '../pages/NotFound.jsx'

/**
 * AppRoutes.jsx
 * Central route registry.
 * All page-level routes are declared here.
 * Wrap routes inside MainLayout to share the Navbar across pages.
 */
const AppRoutes = () => {
  return (
    <Routes>
      {/* Routes wrapped in the shared MainLayout (Navbar + main content area) */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default AppRoutes
