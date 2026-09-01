import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { homePath } from '../../auth/access';
import { notify } from '../../ui/notify';
import './Test.css';

const SEED_PASSWORD = 'Asset@123';

const ACCOUNTS = [
  {
    role: 'ADMIN',
    label: 'Admin',
    name: 'Admin User',
    email: 'admin@internal.local',
    sees: 'Full app. Ticket dispatch and assign.',
  },
  {
    role: 'HR',
    label: 'HR',
    name: 'HR User',
    email: 'hr@internal.local',
    sees: 'Employees and create tickets.',
  },
  {
    role: 'MANAGER',
    label: 'Manager',
    name: 'Manager User',
    email: 'manager@internal.local',
    sees: 'Team tickets. Approve or reject.',
  },
  {
    role: 'ASSET_MANAGER',
    label: 'Asset Manager',
    name: 'Asset Manager',
    email: 'asset.manager@internal.local',
    sees: 'Send approved tickets to Asset Team.',
  },
  {
    role: 'ASSET_TEAM',
    label: 'Asset Team',
    name: 'Kavitha R.',
    email: 'asset.team@internal.local',
    sees: 'Assign stock from tickets. Return.',
  },
  {
    role: 'EMPLOYEE',
    label: 'Employee',
    name: 'Employee User',
    email: 'employee@internal.local',
    sees: 'My assets only.',
  },
];

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    notify.success(`Copied ${label}`);
  } catch {
    notify.error('Could not copy');
  }
}

function gridColumns(el) {
  if (!el) {
    return 1;
  }
  const count = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
  return count || 1;
}

export default function Test() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const gridRef = useRef(null);
  const cardRefs = useRef([]);
  const [busy, setBusy] = useState(null);
  const [focus, setFocus] = useState(() => {
    const i = ACCOUNTS.findIndex((item) => item.email === user?.email);
    return i >= 0 ? i : 0;
  });

  async function openAs(account) {
    if (busy) {
      return;
    }
    setBusy(account.email);
    try {
      const data = await login(account.email, SEED_PASSWORD, true);
      if (!data.ok) {
        notify.error(data.error || 'Could not sign in. Run backend seed:users if this account is missing.');
        return;
      }
      notify.success(`Signed in as ${account.label}`);
      navigate(homePath(data.user.role), { replace: true });
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    cardRefs.current[focus]?.focus();
  }, [focus]);

  useEffect(() => {
    function move(key) {
      const n = ACCOUNTS.length;
      const cols = gridColumns(gridRef.current);
      setFocus((i) => {
        if (key === 'ArrowRight') {
          return (i + 1) % n;
        }
        if (key === 'ArrowLeft') {
          return (i - 1 + n) % n;
        }
        if (key === 'Home') {
          return 0;
        }
        if (key === 'End') {
          return n - 1;
        }
        const col = i % cols;
        if (key === 'ArrowDown') {
          const next = i + cols;
          return next < n ? next : col;
        }
        if (key === 'ArrowUp') {
          const next = i - cols;
          if (next >= 0) {
            return next;
          }
          let last = col + Math.floor((n - 1) / cols) * cols;
          if (last >= n) {
            last -= cols;
          }
          return last;
        }
        return i;
      });
    }

    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || busy) {
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        move(e.key);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('.test-copy')) {
          return;
        }
        e.preventDefault();
        openAs(ACCOUNTS[focus]);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, focus, login, navigate]);

  return (
    <section className="test-page">
      <header className="test-head">
        <h1>Test accounts</h1>
        <p>Arrows move. Enter switches. Same password for all.</p>
        <p className="test-password">
          Password
          <code>{SEED_PASSWORD}</code>
          <button type="button" className="test-copy" tabIndex={-1} onClick={() => copyText(SEED_PASSWORD, 'password')}>
            Copy
          </button>
        </p>
        {user ? (
          <p className="test-now">
            Signed in as <strong>{user.name}</strong> ({user.roleLabel || user.role})
          </p>
        ) : (
          <p className="test-now">Not signed in</p>
        )}
      </header>

      <div ref={gridRef} className="test-accounts">
        {ACCOUNTS.map((account, i) => {
          const current = user?.email === account.email;
          return (
            <article
              key={account.email}
              ref={(node) => {
                cardRefs.current[i] = node;
              }}
              role="button"
              tabIndex={focus === i ? 0 : -1}
              className={`test-account${current ? ' is-on' : ''}${focus === i ? ' is-focus' : ''}`}
              aria-label={`Switch to ${account.label}`}
              onFocus={() => setFocus(i)}
              onClick={() => openAs(account)}
            >
              <div className="test-account-top">
                <h2>{account.label}</h2>
                {current ? <span className="test-badge">Current</span> : null}
              </div>
              <p className="test-account-name">{account.name}</p>
              <p className="test-account-mail">
                <code>{account.email}</code>
                <button
                  type="button"
                  className="test-copy"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    copyText(account.email, 'email');
                  }}
                >
                  Copy
                </button>
              </p>
              <p className="test-account-sees">{account.sees}</p>
              <span className="btn-login">
                {busy === account.email ? 'Signing in…' : current ? 'Open home' : 'Switch'}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
