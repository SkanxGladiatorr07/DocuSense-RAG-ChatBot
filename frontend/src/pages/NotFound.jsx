import { Link } from 'react-router-dom'
import styles from './NotFound.module.css'

/**
 * NotFound.jsx
 * 404 fallback page for unrecognised routes.
 */
const NotFound = () => {
  return (
    <div className={styles.container}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.message}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className={styles.homeLink}>
        ← Back to Home
      </Link>
    </div>
  )
}

export default NotFound
