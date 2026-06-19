import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import styles from './MainLayout.module.css'

/**
 * MainLayout.jsx
 * Shared layout shell: renders the Navbar at the top and the active
 * page via <Outlet /> below it. All routes nested under this layout
 * automatically inherit the Navbar without repeating it.
 */
const MainLayout = () => {
  return (
    <div className={styles.shell}>
      <Navbar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout
