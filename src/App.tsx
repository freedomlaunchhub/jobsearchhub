import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import DailyRefreshProvider from '@/components/DailyRefreshProvider'
import JobDashboard from '@/pages/JobDashboard'
import NetworkDashboard from '@/pages/NetworkDashboard'
import Settings from '@/pages/Settings'
import { seedIfEmpty } from '@/db/seed'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedIfEmpty().then(() => setReady(true))
  }, [])

  if (!ready) return null

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
