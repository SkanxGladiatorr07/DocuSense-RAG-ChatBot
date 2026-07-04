import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes.jsx'
import { AuthProvider } from './context/AuthContext'

/**
 * App.jsx
 * Root component. Wraps the entire app in BrowserRouter and AuthProvider,
 * and delegates route rendering to AppRoutes.
 */
const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
