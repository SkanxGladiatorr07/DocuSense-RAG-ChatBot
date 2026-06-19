import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes.jsx'

/**
 * App.jsx
 * Root component. Wraps the entire app in BrowserRouter and
 * delegates route rendering to AppRoutes.
 */
const App = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
