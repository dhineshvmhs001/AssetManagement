import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { homePath } from '../../auth/access';
import { notify } from '../../ui/notify';
import { forceLoading } from '../../ui/loading';
import './Login.css';

export default function Login() {
  const { isLoggedIn, login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoggedIn) {
    return <Navigate to={homePath(user?.role)} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    forceLoading(true);
    try {
      const data = await login(email, password, remember);
      if (!data.ok) {
        notify.error(data.error || 'Invalid email or password');
        return;
      }
      notify.success('Signed in');
      navigate(homePath(data.user.role), { replace: true });
    } finally {
      forceLoading(false);
      setBusy(false);
    }
  }

  return (
    <section className="login-page">
      <div className="login-wrap">
        <div className="login-logo-wrap">
          <span className="login-logo-glow" />
          <img
            className="login-logo"
            src="/logo.png"
            srcSet="/logo.png 1x, /logo@2x.png 2x"
            alt="My Health School"
          />
        </div>
        <p className="login-product">Asset Management</p>

        <form className="login-card" onSubmit={handleSubmit}>

          <label className="field" htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field" htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me
          </label>

          <div className="login-actions">
            <button type="button" className="forgot">
              Forgot your password?
            </button>
            <button type="submit" className="btn-login" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
