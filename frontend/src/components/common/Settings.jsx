import { useEffect, useState } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { SKIN_META } from '../../theme/skins';
import { LOADERS } from '../../ui/loaders';
import LogoLoader from '../../ui/LogoLoader';
import { Icon } from '../layout/NavIcons';
import './Settings.css';

export default function SettingsButton({ variant = 'rail' }) {
  const [open, setOpen] = useState(false);
  const { colorMode, setColorMode, skin, setSkin, density, setDensity, loader, setLoader } = useTheme();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={variant === 'rail' ? 'app-rail-logout' : 'settings-float'}
        onClick={() => setOpen(true)}
        title="Settings"
        aria-label="Settings"
      >
        <Icon name="settings" />
      </button>

      {open ? (
        <div className="settings-overlay" onClick={() => setOpen(false)}>
          <aside className="settings-panel" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
            <div className="settings-head">
              <h2>Settings</h2>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <section>
              <h3>Appearance</h3>
              <p>Saved in this browser. It stays the same next time you open the app.</p>
              <div className="settings-seg">
                {[
                  ['light', 'Light'],
                  ['dark', 'Dark'],
                  ['system', 'System'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={colorMode === id ? 'is-on' : undefined}
                    onClick={() => setColorMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3>Density</h3>
              <div className="settings-seg">
                <button
                  type="button"
                  className={density === 'comfortable' ? 'is-on' : undefined}
                  onClick={() => setDensity('comfortable')}
                >
                  Comfortable
                </button>
                <button
                  type="button"
                  className={density === 'compact' ? 'is-on' : undefined}
                  onClick={() => setDensity('compact')}
                >
                  Compact
                </button>
              </div>
            </section>

            <section>
              <h3>Theme</h3>
              <div className="settings-skins">
                {SKIN_META.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-skin${skin === item.id ? ' is-on' : ''}`}
                    onClick={() => setSkin(item.id)}
                  >
                    <span
                      className="settings-swatch"
                      style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}
                    />
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3>Loader</h3>
              <p>No loading skips the overlay. Minimal is a quiet spinner. The rest use the logo.</p>
              <div className="settings-loaders">
                {LOADERS.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    className={`settings-loader${loader === item.kind ? ' is-on' : ''}`}
                    onClick={() => setLoader(item.kind)}
                  >
                    <span className="settings-loader-stage">
                      <LogoLoader kind={item.kind} />
                    </span>
                    <span className="settings-loader-name">
                      {item.kind === 'none' || item.kind === 'minimal' ? item.name : `${item.id}. ${item.name}`}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <p className="settings-hint">Keyboard shortcuts: press ?</p>
          </aside>
        </div>
      ) : null}
    </>
  );
}
