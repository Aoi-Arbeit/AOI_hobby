import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useWebSocket } from './hooks/useWebSocket'
import Login from './pages/Login'
import Trade from './pages/Trade'
import Stats from './pages/Stats'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Elliott from './pages/Elliott'
import Learn from './pages/Learn'
import Settings from './pages/Settings'
import { useStore } from './store'

function AppInner() {
  useWebSocket()
  const { token, fetchAccount, fetchPositions } = useStore()

  useEffect(() => {
    if (token) { fetchAccount(); fetchPositions() }
  }, [token])

  return (
    <Routes>
      <Route path="/login" element={!token ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/trade" element={token ? <Trade /> : <Navigate to="/login" />} />
      <Route path="/calendar" element={token ? <Calendar /> : <Navigate to="/login" />} />
      <Route path="/elliott" element={token ? <Elliott /> : <Navigate to="/login" />} />
      <Route path="/learn" element={token ? <Learn /> : <Navigate to="/login" />} />
      <Route path="/stats" element={token ? <Stats /> : <Navigate to="/login" />} />
      <Route path="/settings" element={token ? <Settings /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
