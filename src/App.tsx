import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import DailyRefreshProvider from '@/components/DailyRefreshProvider'
import JobDashboard from '@/pages/JobDashboard'
import NetworkDashboard from '@/pages/NetworkDashboard'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'login' | 'authenticated'>('loading')
  const [hasUsers, setHasUsers] = useState(true)

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      const data = await res.json()
      if (data.authenticated) {
        setAuthState('authenticated')
      } else {
        setHasUsers(data.hasUsers ?? true)
        setAuthState('login')
      }
    } catch {
      setAuthState('login')
    }
  }

  useEffect(() => { checkAuth() }, [])

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    )
  }

  if (authState === 'login') {
    return <Login hasUsers={hasUsers} onAuth={() => setAuthState('authenticated')} />
  }

  return (
    <BrowserRouter>
      <DailyRefreshProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/jobs" replace />} />
            <Route path="/jobs" element={<JobDashboard />} />
            <Route path="/network" element={<NetworkDashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </DailyRefreshProvider>
    </BrowserRouter>
  )
}
