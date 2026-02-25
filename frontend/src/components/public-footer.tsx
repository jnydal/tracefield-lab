import { Link, useLocation } from 'react-router-dom';

const COPYRIGHT_YEAR = new Date().getFullYear();
/** Replace with your name; used in the public footer. */
const AUTHOR_NAME = 'Thor Nydal';

export function PublicFooter() {
  const { pathname } = useLocation();
  const isAbout = pathname === '/about';

  const linkClass = 'text-violet-600 hover:text-violet-800 hover:underline';

  return (
    <footer className="mt-12 flex flex-col items-center gap-2 text-center text-sm text-slate-500">
      <p>
        <span aria-hidden="true">©</span> {COPYRIGHT_YEAR} {AUTHOR_NAME}.
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {isAbout ? (
          <Link to="/" className={linkClass}>
            Back to home
          </Link>
        ) : (
          <Link to="/about" className={linkClass}>
            About this project
          </Link>
        )}
        <a
          href="https://www.linkedin.com/in/thor-jørund-nydal-39a48510"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          aria-label="Thor Nydal on LinkedIn"
        >
          LinkedIn profile
        </a>
      </p>
    </footer>
  );
}
