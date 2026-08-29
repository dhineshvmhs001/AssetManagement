import { LOADERS } from '../../ui/loaders';
import LogoLoader from '../../ui/LogoLoader';
import { useTheme } from '../../theme/ThemeProvider';
import './Test.css';

export default function Test() {
  const { loader, setLoader } = useTheme();

  return (
    <section className="test-page">
      <header className="test-head">
        <h1>Logo loaders</h1>
        <p>Click one to use it while pages load. You can also pick it in Settings.</p>
      </header>
      <div className="test-grid">
        {LOADERS.map((item) => (
          <button
            key={item.kind}
            type="button"
            className={`test-card${loader === item.kind ? ' is-on' : ''}`}
            onClick={() => setLoader(item.kind)}
          >
            <span className="test-num">{item.id || '—'}</span>
            <div className="test-stage">
              <LogoLoader kind={item.kind} />
            </div>
            <h2>{item.name}</h2>
          </button>
        ))}
      </div>
    </section>
  );
}
