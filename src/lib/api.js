import axios from 'axios'
import { useAuthStore } from '../store/authStore.js'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
})

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken, setTokens, logout } = useAuthStore.getState()
      if (!refreshToken) { logout(); return Promise.reject(err) }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = 'Bearer ' + token
          return api(original)
        }).catch(Promise.reject)
      }

      isRefreshing = true
      try {
        const { data } = await axios.post((import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/auth/refresh', { refreshToken })
        setTokens(data.accessToken, data.refreshToken)
        original.headers.Authorization = 'Bearer ' + data.accessToken
        processQueue(null, data.accessToken)
        return api(original)
      } catch (e) {
        processQueue(e, null)
        useAuthStore.getState().logout()
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export default api
