import { NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

/**
 * Navbar.jsx
 * Top navigation bar. Uses NavLink so the active route gets an
 * "active" class automatically (styled via CSS module).
 * Reusable — no props required. Add new nav items here as the
 * project grows.
 */
const Navbar = () => {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        {/* Brand */}
        <NavLink to="/" className={styles.brand}>
          <span className={styles.brandIcon}>◈</span>
          <span className={styles.brandName}>DocuSense</span>
        </NavLink>

        {/* Navigation Links */}
        <ul className={styles.links}>
          <li>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
            >
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
            >
              Dashboard
            </NavLink>
          </li>
        </ul>
      </nav>
    </header>
  )
}

export default Navbar
