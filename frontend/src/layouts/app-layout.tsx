import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { clearAuth, selectUser } from '../features/auth/redux/auth-slice';
import { useLogoutMutation } from '../services/api/auth-api';

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

export function AppLayout() {
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const label = user?.displayName || user?.email || user?.username || 'User';
  const initials = getInitials(label);

  const handleSignOut = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Ignore logout errors and still clear local auth state.
    } finally {
      dispatch(clearAuth());
      setUserMenuOpen(false);
      setMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-lg font-semibold text-slate-900">
              Tracefield Lab
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm text-slate-600">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className="app-nav-link">
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <button
                type="button"
                className="flex items-center gap-3 text-right"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span>
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">Signed in</p>
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {initials}
                </span>
              </button>
              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-40 rounded border border-slate-200 bg-white py-2 text-sm shadow"
                >
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleSignOut}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                  <div
                    className="border-t border-slate-100 px-3 py-2 text-slate-400"
                    aria-hidden
                  >
                    Build {import.meta.env.VITE_BUILD_ID ?? 'dev'}
                  </div>
                </div>
              )}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white sm:hidden">
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
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="app-nav-link-mobile"
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                className="text-left text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSignOut}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="app-main-content rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg backdrop-blur-sm sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
