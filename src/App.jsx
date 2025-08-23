import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Home from './pages/Home.jsx'
import AddUser from './pages/AddUser.jsx'
import SuperAdmin from './pages/SuperAdmin.jsx'
import Profile from './pages/Profile.jsx'
import Users from './pages/Users.jsx'            // 👈 NEW
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Authenticated for everyone */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Admin + Superadmin */}
      <Route element={<ProtectedRoute roles={['admin','superadmin']} />}>
        <Route path="/users" element={<Users />} />     {/* 👈 NEW route */}
        <Route path="/add-user" element={<AddUser />} />
      </Route>

      {/* Superadmin only */}
      <Route element={<ProtectedRoute roles={['superadmin']} />}>
        <Route path="/superadmin" element={<SuperAdmin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
