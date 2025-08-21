import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,

  login: ({ user, accessToken, refreshToken }) => {
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    set({ user, accessToken, refreshToken })
  },
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    set({ accessToken, refreshToken })
  },
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },
  logout: () => {
    localStorage.removeItem('user')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({ user: null, accessToken: null, refreshToken: null })
  },
  isAdmin: () => ['admin', 'superadmin'].includes(get().user?.role),
  isSuperAdmin: () => get().user?.role === 'superadmin',
}))
