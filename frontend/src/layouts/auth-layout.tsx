import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

interface AuthLayoutProps {
  children?: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),_transparent_35%),_radial-gradient(circle_at_bottom_right,_rgba(148,163,184,0.12),_transparent_40%)]" />
        <div className="relative w-full max-w-md">
          {children || <Outlet />}
        </div>
      </div>
    </div>
  );
}

