import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Navbar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, logout } = useAuth()

  // Notification panel state
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const notifPanelRef = useRef(null)

  // Demo: empty means "no notifications". Add objects here to show real notifications.
  const notifications = []

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // Close panel when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setShowNotifPanel(false)
      }
    }
    if (showNotifPanel) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifPanel])

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface border-b border-outline-variant">
      <div className="flex justify-between items-center px-6 h-16 w-full max-w-container-max mx-auto">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-title-md font-title-md font-bold text-primary">DocuSense</Link>
          <div className="hidden md:flex gap-6">
            <Link 
              to="/"
              className={`font-body-md text-body-md font-bold transition-all duration-200 ${
                location.pathname === '/' 
                  ? 'text-primary border-b-2 border-primary pb-1' 
                  : 'text-secondary hover:text-primary'
              }`} 
            >
              Home
            </Link>
            {token && (
              <Link 
                to="/dashboard"
                className={`font-body-md text-body-md font-bold transition-all duration-200 ${
                  location.pathname === '/dashboard' 
                    ? 'text-primary border-b-2 border-primary pb-1' 
                    : 'text-secondary hover:text-primary'
                }`} 
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <input className="pl-10 pr-4 py-1.5 rounded-full border border-outline-variant bg-surface-container-low text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-64" placeholder="Search knowledge..." type="text" />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          </div>
          
          {/* Notification Bell */}
          <div className="relative" ref={notifPanelRef}>
            <button
              onClick={() => setShowNotifPanel(prev => !prev)}
              className="relative p-2 text-secondary hover:text-primary transition-colors rounded-full hover:bg-surface-container-low"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined">notifications</span>
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-surface" />
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifPanel && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-outline-variant rounded-2xl shadow-xl z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container-low">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                    <span className="font-bold text-on-surface text-[14px]">Notifications</span>
                  </div>
                  {notifications.length > 0 && (
                    <span className="text-[11px] font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">
                      {notifications.length} new
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-outline text-[28px]">notifications_off</span>
                      </div>
                      <div>
                        <p className="font-bold text-on-surface text-[13px]">All caught up!</p>
                        <p className="text-secondary text-[12px] mt-0.5">No new notifications right now. We'll let you know when something happens.</p>
                      </div>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors border-b border-outline-variant/50 last:border-0">
                        <span className={`material-symbols-outlined text-[18px] mt-0.5 ${
                          notif.type === 'success' ? 'text-emerald-500' :
                          notif.type === 'error' ? 'text-red-500' :
                          'text-primary'
                        }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                          {notif.type === 'success' ? 'check_circle' : notif.type === 'error' ? 'error' : 'info'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-on-surface text-[13px] font-medium leading-snug">{notif.message}</p>
                          <p className="text-outline text-[11px] mt-0.5">{notif.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-outline-variant bg-surface-container-low/50">
                  <button className="w-full text-center text-[12px] font-bold text-primary hover:opacity-80 transition-opacity">
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {token ? (
            <>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-outline-variant text-secondary hover:text-error hover:bg-error-container/20 transition-all font-label-md text-label-md"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
                Logout
              </button>
              <button 
                onClick={() => navigate('/profile')}
                className="h-8 w-8 rounded-full bg-primary-fixed overflow-hidden border border-outline-variant flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer" 
                title={user?.name ? `${user.name} — View Profile` : 'View Profile'}
                aria-label="Open profile"
              >
                {user?.name ? (
                  <span className="text-[12px] font-bold text-primary font-body-md uppercase">{user.name.slice(0, 2)}</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                )}
              </button>
            </>
          ) : (
            <Link 
              to="/login"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-white hover:bg-on-primary-fixed-variant transition-all font-label-md text-label-md"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar

