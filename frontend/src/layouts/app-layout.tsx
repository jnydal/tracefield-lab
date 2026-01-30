import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { selectUser } from '../features/auth/redux/auth-slice';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: 'Datasets', to: '/datasets' },
  { label: 'Entity mappings', to: '/entity-mappings' },
  { label: 'Features', to: '/features' },
  { label: 'Analysis jobs', to: '/analysis-jobs' },
  { label: 'Results', to: '/analysis-results' },
];

function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function AppLayout({ children }: AppLayoutProps) {
  const user = useAppSelector(selectUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const label = user?.displayName || user?.email || user?.username || 'User';
  const initials = getInitials(label);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-lg font-semibold text-slate-900">
              Tracefield Lab
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm text-slate-600">
              {navItems.map((item) => (
                <Link key={item.to} to={item.to} className="hover:text-slate-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">Signed in</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {initials}
            </div>
            <button
              type="button"
              className="md:hidden rounded border border-slate-200 px-3 py-2 text-xs text-slate-600"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div id="mobile-nav" className="border-t border-slate-100 bg-white md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-sm">
              {navItems.map((item) => (
                <Link key={item.to} to={item.to} className="text-slate-700">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
