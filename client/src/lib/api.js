import axios from 'axios'

export const UNAUTHORIZED_EVENT = 'auth:unauthorized'
export const ADMIN_UNAUTHORIZED_EVENT = 'admin-auth:unauthorized'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api`,
  withCredentials: true,
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const data = err.response?.data ?? {}
    if (data.code === 'UNAUTHENTICATED') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    if (data.code === 'ADMIN_UNAUTHENTICATED') window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT))
    // Normalised error shape: { status, message, code?, details? }
    return Promise.reject({
      status: err.response?.status,
      message: data.message ?? err.message ?? 'Something went wrong',
      code: data.code,
      details: data.details,
    })
  },
)

/** Copies server-side field errors ({ field: message }) onto a react-hook-form instance. */
export function applyFieldErrors(error, setError, fields) {
  let applied = false
  for (const [field, message] of Object.entries(error?.details ?? {})) {
    if (!fields || fields.includes(field)) {
      setError(field, { type: 'server', message })
      applied = true
    }
  }
  return applied
}

export default api
