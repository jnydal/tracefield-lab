import { Outlet } from 'react-router-dom';
import { PublicFooter } from '../components/public-footer';

/**
 * Layout for all non-logged-in pages (landing, about, login, register, etc.).
 * Renders page content and a shared footer.
 */
export function PublicLayout() {
  return (
    <>
      <Outlet />
      <PublicFooter />
    </>
  );
}
