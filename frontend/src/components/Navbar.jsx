import { Link, useLocation } from 'react-router-dom'

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface border-b border-outline-variant">
      <div className="flex justify-between items-center px-6 h-16 w-full max-w-container-max mx-auto">
        <div className="flex items-center gap-8">
          <span className="text-title-md font-title-md font-bold text-primary">DocuSense</span>
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
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <input className="pl-10 pr-4 py-1.5 rounded-full border border-outline-variant bg-surface-container-low text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-64" placeholder="Search knowledge..." type="text" />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          </div>
          <button className="p-2 text-secondary hover:text-primary transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-2 text-secondary hover:text-primary transition-colors">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-outline-variant text-secondary hover:text-primary hover:bg-surface-container transition-all" aria-label="Toggle Dark Mode">
            <span className="material-symbols-outlined text-[20px]">dark_mode</span>
            <span className="font-label-md text-label-md">Dark Mode</span>
          </button>
          <div className="h-8 w-8 rounded-full bg-primary-fixed overflow-hidden border border-outline-variant">
            <img className="w-full h-full object-cover" alt="Profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYyXWsQCxCZ3bQwDue48HEUq9iUQuEoR4ewNXXkxv0T6p5wR9ZSDXGzmKP5SPO9p1YRdcnjlwYQagTFNtSp39Pjo5zXco6ZTVasKQy1OA8UQmauBt0ZLiLXe-5RvuhBFcf4FKu-sLTGJUCjhfwoOq8vtpse0d_NPpKcMFWo-53BBTFveIejNq3U7yYkZNBHJxNZD5bvOZLV_SznkPvzkLLCvgpRqyuErQtgWaUKc0R1Wzy3AbuyNKdIQ" />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
