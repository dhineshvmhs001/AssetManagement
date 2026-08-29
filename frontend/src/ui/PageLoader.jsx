import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../theme/ThemeProvider';
import LogoLoader from './LogoLoader';
import { armRouteLoading, subscribeLoading } from './loading';
import './PageLoader.css';

export default function PageLoader() {
  const { pathname } = useLocation();
  const { loader } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pathname === '/test' || pathname === '/mail') {
      return undefined;
    }
    armRouteLoading();
    return undefined;
  }, [pathname]);

  useEffect(() => subscribeLoading(setOpen), []);

  if (!open || loader === 'none') {
    return null;
  }

  return (
    <div
      className={`page-loader${loader === 'minimal' ? ' page-loader--minimal' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="page-loader-mark">
        <LogoLoader kind={loader} />
      </div>
    </div>
  );
}
