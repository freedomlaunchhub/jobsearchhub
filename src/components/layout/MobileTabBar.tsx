import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Settings as SettingsIcon } from 'lucide-react';

const tabs = [
  { to: '/jobs', label: 'Jobs', icon: LayoutDashboard },
  { to: '/network', label: 'Network', icon: Users },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function MobileTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex md:hidden border-t border-slate-700 bg-sidebar">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
              isActive ? 'text-primary' : 'text-slate-400'
            }`
          }
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
