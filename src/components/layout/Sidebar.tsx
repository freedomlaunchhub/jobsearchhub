import { NavLink } from 'react-router-dom';
import { Briefcase, LayoutDashboard, Users, Settings as SettingsIcon, Flame } from 'lucide-react';

interface SidebarProps {
  streak: number;
}

function getFlameColor(streak: number): string {
  if (streak >= 30) return 'text-yellow-400';
  if (streak >= 14) return 'text-accent';
  if (streak >= 7) return 'text-primary';
  if (streak >= 1) return 'text-attention';
  return 'text-slate-500';
}

const navItems = [
  { to: '/jobs', label: 'Job Dashboard', icon: LayoutDashboard },
  { to: '/network', label: 'Network HQ', icon: Users },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ streak }: SidebarProps) {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 flex-col bg-sidebar text-white">
      <div className="flex items-center gap-3 px-5 py-6">
        <Briefcase className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">Job Search Hub</span>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sidebar-hover text-primary'
                      : 'text-slate-400 hover:text-white hover:bg-sidebar-hover'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-700 px-5 py-4">
        <div className="flex items-center gap-3">
          <Flame className={`h-5 w-5 ${getFlameColor(streak)}`} />
          <span className="text-sm text-slate-300">
            <span className="font-semibold text-white">{streak}</span> day streak
          </span>
        </div>
      </div>
    </aside>
  );
}
