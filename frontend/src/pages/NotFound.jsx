import { Link } from 'react-router-dom'

/**
 * NotFound.jsx
 * 404 fallback page for unrecognised routes.
 */
const NotFound = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center">
      <span className="text-display font-display text-primary mb-2">404</span>
      <h1 className="text-headline-lg font-headline-lg text-on-surface mb-4">Page not found</h1>
      <p className="text-body-lg text-secondary mb-8 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity">
        ← Back to Home
      </Link>
    </div>
  )
}

export default NotFound
