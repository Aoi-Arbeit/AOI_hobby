import axios from 'axios'

const api = axios.create({ baseURL: '/' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fx_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fx_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const getEconomicEvents = (params?: { importance?: string; country?: string; days?: number }) =>
  api.get('/economic/events', { params }).then(r => r.data)

export const getStatsMonthly = () => api.get('/stats/monthly').then(r => r.data)
export const getStatsBySymbol = () => api.get('/stats/by-symbol').then(r => r.data)
export const exportTrades = () => api.get('/trades/export', { responseType: 'blob' }).then(r => r.data)

export const getAnnotations = (symbol?: string, timeframe?: string) =>
  api.get('/annotations', { params: { symbol, timeframe } }).then(r => r.data)
export const createAnnotation = (body: any) => api.post('/annotations', body).then(r => r.data)
export const deleteAnnotation = (id: string) => api.delete(`/annotations/${id}`).then(r => r.data)
export const updateSlTp = (positionId: string, body: { sl_price?: number | null; tp_price?: number | null }) =>
  api.patch(`/positions/${positionId}/sl-tp`, body).then(r => r.data)
export const closeAllPositions = () => api.post('/positions/close-all').then(r => r.data)
