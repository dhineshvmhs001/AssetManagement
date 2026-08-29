import { useEffect, useId, useRef } from 'react';
import { normalizeLoader } from './loaders';
import './LogoLoader.css';

function Logo({ className = '' }) {
  return (
    <img
      className={`loader-logo ${className}`.trim()}
      src="/logo.png"
      srcSet="/logo.png 1x, /logo@2x.png 2x"
      alt=""
    />
  );
}

function Decor({ kind, sweepId }) {
  if (kind === 'orbit') {
    return (
      <>
        <span className="loader-orbit-dot" />
        <span className="loader-orbit-dot" />
        <span className="loader-orbit-dot" />
      </>
    );
  }

  if (kind === 'sonar') {
    return (
      <>
        <span className="loader-wave" />
        <span className="loader-wave" />
        <span className="loader-wave" />
      </>
    );
  }

  if (kind === 'constellation') {
    return (
      <>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="loader-star" style={{ '--i': i }} />
        ))}
      </>
    );
  }

  if (kind === 'fireflies') {
    return (
      <>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="loader-fly" style={{ '--i': i }} />
        ))}
      </>
    );
  }

  if (kind === 'bloom') {
    return (
      <>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="loader-petal" style={{ '--i': i }} />
        ))}
      </>
    );
  }

  if (kind === 'helix') {
    return (
      <>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="loader-helix-dot" style={{ '--i': i }} />
        ))}
      </>
    );
  }

  if (kind === 'radar') {
    return (
      <>
        <span className="loader-radar-grid" />
        <span className="loader-radar-sweep" />
      </>
    );
  }

  if (kind === 'comet') {
    return (
      <>
        <span className="loader-comet-path" />
        <span className="loader-comet-arm">
          <span className="loader-comet-head" />
        </span>
      </>
    );
  }

  if (kind === 'sweep') {
    return (
      <svg className="loader-sweep-svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id={sweepId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-from, #7c3aed)" />
            <stop offset="55%" stopColor="var(--brand-to, #ec4899)" />
            <stop offset="100%" stopColor="var(--brand-to, #ec4899)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle className="loader-sweep-track" cx="60" cy="60" r="53" />
        <circle className="loader-sweep-line" cx="60" cy="60" r="53" stroke={`url(#${sweepId})`} />
      </svg>
    );
  }

  return null;
}

/* Wanders on its own, and bolts away when the cursor closes in. Steering is done
   straight on the DOM node so the chase does not re-render React 60 times a second. */
function CatchButterfly({ wings, className }) {
  const boxRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    const box = boxRef.current;
    const body = bodyRef.current;
    if (!box || !body) {
      return undefined;
    }

    let rect = box.getBoundingClientRect();
    let scale = rect.width / (box.offsetWidth || 1) || 1;
    let width = box.offsetWidth || 120;
    let height = box.offsetHeight || 120;
    let pad = Math.min(34, width * 0.22, height * 0.22);

    function measure() {
      rect = box.getBoundingClientRect();
      width = box.offsetWidth || 120;
      height = box.offsetHeight || 120;
      scale = rect.width / width || 1;
      pad = Math.min(34, width * 0.22, height * 0.22);
    }

    function pickTarget() {
      return {
        x: pad + Math.random() * Math.max(1, width - pad * 2),
        y: pad + Math.random() * Math.max(1, height - pad * 2),
      };
    }

    let x = width / 2;
    let y = height / 2;
    let vx = 0;
    let vy = 0;
    let target = pickTarget();
    let pointer = null;
    let panic = 0;
    let last = performance.now();
    let raf = 0;

    function onPointer(e) {
      pointer = {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      let ax = target.x - x;
      let ay = target.y - y;
      const reach = Math.hypot(ax, ay) || 1;
      if (reach < 16) {
        target = pickTarget();
      }
      ax = (ax / reach) * 260;
      ay = (ay / reach) * 260;

      if (pointer) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const gap = Math.hypot(dx, dy) || 1;
        const range = Math.max(70, Math.min(190, width * 0.3));
        if (gap < range) {
          const push = (1 - gap / range) * 3400;
          ax += (dx / gap) * push;
          ay += (dy / gap) * push;
          panic = 1;
          if (gap < range * 0.45) {
            target = pickTarget();
          }
        }
      }

      panic = Math.max(0, panic - dt * 1.4);
      vx = (vx + ax * dt) * 0.94;
      vy = (vy + ay * dt) * 0.94;

      const speed = Math.hypot(vx, vy);
      const cap = 260 + panic * 700;
      if (speed > cap) {
        vx = (vx / speed) * cap;
        vy = (vy / speed) * cap;
      }

      x += vx * dt;
      y += vy * dt;

      if (x < pad) {
        x = pad;
        vx = Math.abs(vx) * 0.7;
        target = pickTarget();
      }
      if (x > width - pad) {
        x = width - pad;
        vx = -Math.abs(vx) * 0.7;
        target = pickTarget();
      }
      if (y < pad) {
        y = pad;
        vy = Math.abs(vy) * 0.7;
        target = pickTarget();
      }
      if (y > height - pad) {
        y = height - pad;
        vy = -Math.abs(vy) * 0.7;
        target = pickTarget();
      }

      const bank = Math.max(-30, Math.min(30, vx * 0.06));
      body.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${bank}deg)`;
      body.classList.toggle('is-panic', panic > 0.15);

      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(measure);
    ro.observe(box);
    window.addEventListener('pointermove', onPointer);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className={`loader loader-butterfly loader-catch ${className}`.trim()}
      aria-hidden="true"
    >
      <span ref={bodyRef} className="loader-catch-body">
        {wings}
      </span>
    </div>
  );
}

export default function LogoLoader({ kind, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const resolved = normalizeLoader(kind);

  if (resolved === 'none') {
    return (
      <div className={`loader loader-none ${className}`.trim()} aria-hidden="true">
        Off
      </div>
    );
  }

  if (resolved === 'minimal') {
    return (
      <div className={`loader loader-minimal ${className}`.trim()} aria-hidden="true">
        <Logo />
      </div>
    );
  }

  if (resolved === 'prism') {
    return (
      <div className={`loader loader-prism ${className}`.trim()} aria-hidden="true">
        <Logo className="loader-logo-base" />
        <Logo className="loader-logo-lit" />
      </div>
    );
  }

  if (resolved === 'equalizer') {
    return (
      <div className={`loader loader-equalizer ${className}`.trim()} aria-hidden="true">
        <Logo />
        <span className="loader-bars">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="loader-bar" style={{ '--i': i }} />
          ))}
        </span>
      </div>
    );
  }

  if (resolved === 'butterfly' || resolved === 'roam' || resolved === 'hover' || resolved === 'catch') {
    const wings = (
      <span className="loader-flutter">
        <span className="loader-wing loader-wing-l">
          <Logo />
        </span>
        <span className="loader-wing loader-wing-r">
          <Logo />
        </span>
      </span>
    );

    if (resolved === 'catch') {
      return <CatchButterfly wings={wings} className={className} />;
    }

    if (resolved === 'roam') {
      return (
        <div className={`loader loader-butterfly loader-roam ${className}`.trim()} aria-hidden="true">
          <span className="loader-roam-track">{wings}</span>
        </div>
      );
    }

    return (
      <div
        className={`loader loader-butterfly${resolved === 'hover' ? ' loader-hover' : ''} ${className}`.trim()}
        aria-hidden="true"
      >
        {wings}
      </div>
    );
  }

  if (resolved === 'liquid') {
    return (
      <div className={`loader loader-liquid ${className}`.trim()} aria-hidden="true">
        <Logo className="loader-logo-base" />
        <span className="loader-liquid-clip">
          <span className="loader-liquid-body" />
        </span>
      </div>
    );
  }

  if (resolved === 'flip') {
    return (
      <div className={`loader loader-flip ${className}`.trim()} aria-hidden="true">
        <span className="loader-flip-plate">
          <Logo />
        </span>
        <span className="loader-flip-shadow" />
      </div>
    );
  }

  return (
    <div className={`loader loader-${resolved} ${className}`.trim()} aria-hidden="true">
      <Decor kind={resolved} sweepId={`loaderSweep-${uid}`} />
      <Logo />
    </div>
  );
}
