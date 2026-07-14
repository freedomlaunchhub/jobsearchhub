import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileTabBar from './MobileTabBar'
import { useSettings } from '@/hooks/useSettings'
import { useStreak } from '@/hooks/useStreak'

export default function AppLayout() {
  const { settings, updateSettings } = useSettings()
  const { streak } = useStreak({ settings, updateSettings })

  return (
    <div className="flex min-h-screen">
      <Sidebar streak={streak} />
      <main className="ml-0 md:ml-60 flex-1 bg-slate-50 p-6 pb-16 md:pb-6">
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  )
}
