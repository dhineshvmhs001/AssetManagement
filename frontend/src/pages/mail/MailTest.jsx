import { useState } from 'react';
import { sendTestMail } from '../../api/mail.api';
import '../test/Test.css';

export default function MailTest() {
  const [to, setTo] = useState('dhinesh.vmhs@gmail.com');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const data = await sendTestMail(to);
    setBusy(false);
    setResult(data);
  }

  return (
    <section className="test-page">
      <h2>Test mail</h2>
      <p>Sends one message using SMTP from backend/.env</p>

      <form onSubmit={handleSubmit} className="mail-test-form">
        <label>
          To
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send test mail'}
        </button>
      </form>

      {result && (
        <p className={`test-status ${result.ok ? 'ok' : 'fail'}`}>
          {result.ok ? `Sent to ${result.to}` : result.error || 'Could not send mail'}
        </p>
      )}
    </section>
  );
}
