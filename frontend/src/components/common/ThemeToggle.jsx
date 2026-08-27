import { useTheme } from '../../theme/ThemeProvider';
import './ThemeToggle.css';

export default function ThemeToggle({ embedded = false, tabIndex }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`theme-switch${isDark ? ' is-dark' : ''}${embedded ? ' embedded' : ''}`}
      tabIndex={tabIndex}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
    >
      <span className="theme-switch-stars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="theme-switch-cloud cloud-a" aria-hidden="true" />
      <span className="theme-switch-cloud cloud-b" aria-hidden="true" />
      <span className="theme-switch-orb" aria-hidden="true" />
    </button>
  );
}
