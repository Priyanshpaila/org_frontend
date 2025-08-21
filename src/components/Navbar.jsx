import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'

export default function Navbar() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuthStore()
  const nav = useNavigate()
  const onLogout = () => { logout(); nav('/login') }

  return (
    <div className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600"></div>
          <span className="text-lg font-semibold">YourCompany</span>
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin() && <Link to="/add-user" className="btn btn-ghost">Add User</Link>}
          {isSuperAdmin() && <Link to="/superadmin" className="btn btn-ghost">Superadmin</Link>}
          <Link to="/profile" className="btn btn-ghost">{user?.name}</Link>
          <button onClick={onLogout} className="btn btn-primary">Logout</button>
        </div>
      </div>
    </div>
  )
}
