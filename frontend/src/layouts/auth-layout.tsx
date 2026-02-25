import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { PublicFooter } from '../components/public-footer';

interface AuthLayoutProps {
  children?: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {children || <Outlet />}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

