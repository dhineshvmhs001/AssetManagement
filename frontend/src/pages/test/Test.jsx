import { useEffect, useState } from 'react';
import { getTest } from '../../api/test.api';
import './Test.css';

export default function Test() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTest()
      .then((data) => setResult(data))
      .catch(() => setError('Could not reach GET /api/test.'));
  }, []);

  const connected = result?.connected === true;

  return (
    <section className="test-page">
      <p className="test-hub" role="status" aria-live="polite">
        <span className="test-hub-start">Load</span>
        <span className="test-hub-end">ing</span>
      </p>

      {error && <p className="test-status fail">{error}</p>}

      {result && (
        <>
          <p className={`test-status ${connected ? 'ok' : 'fail'}`}>
            {connected ? 'Connection successful' : 'Connection failed'}
          </p>
          <p>Database: {result.database || 'Asset_Management'}</p>
          {connected && result.now && <p>Server time: {result.now}</p>}
          {!connected && result.error && <p className="test-error">{result.error}</p>}
        </>
      )}
    </section>
  );
}

function test(){
  const checks = [];

  const assert = (label, passed) => {
    checks.push({ label, passed });
    console.log(`${passed ? 'PASS' : 'FAIL'} - ${label}`);
  };

  return getTest()
    .then((data) => {
      assert('response is an object', data !== null && typeof data === 'object');
      assert('has boolean connected flag', typeof data?.connected === 'boolean');

      if (data?.connected === true) {
        assert('connected response reports a database', typeof data.database === 'string' && data.database.length > 0);
        assert('connected response reports server time', Boolean(data.now));
      } else {
        assert('failed response reports an error', Boolean(data?.error));
      }
    })
    .catch((err) => {
      assert(`GET /api/test reachable (${err?.message || err})`, false);
    })
    .then(() => {
      const failed = checks.filter((c) => !c.passed);
      console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
      return { checks, ok: failed.length === 0 };
    });
}
