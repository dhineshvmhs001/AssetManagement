import { useEffect, useState } from 'react';
import { getAssetTemplate, importAssets } from '../../api/assets.api';
import { notify } from '../../ui/notify';
import FilePicker from './FilePicker';

export default function BulkImport() {
  const [csv, setCsv] = useState('');
  const [csvFile, setCsvFile] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState(null);

  useEffect(() => {
    getAssetTemplate().then((data) => {
      if (data.ok) {
        setTemplate(data);
      }
    });
  }, []);

  async function downloadTemplate() {
    const data = template?.ok ? template : await getAssetTemplate();
    if (!data.ok) {
      notify.error(data.error || 'Could not download template');
      return;
    }
    const blob = new Blob([data.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename || 'assets_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFiles(next) {
    const file = next[0];
    setCsvFile(file ? [file] : []);
    setResult(null);
    if (!file) {
      setCsv('');
      return;
    }
    setCsv(await file.text());
    notify.success('CSV loaded', 'Click import when you are ready.');
  }

  async function handleImport() {
    setBusy(true);
    const data = await importAssets(csv);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Import failed');
      return;
    }
    setResult(data);
    if (data.errors?.length) {
      notify.error(`Imported ${data.imported}, ${data.errors.length} row(s) failed`);
    } else {
      notify.success(`Imported ${data.imported} assets`);
    }
  }

  const dataRows = csv ? csv.split(/\r?\n/).filter(Boolean).length - 1 : 0;

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Bulk import</h2>
          <p>CSV template, validation, duplicate serial check. Valid rows only are imported.</p>
        </div>
        <button type="button" className="btn ghost" onClick={downloadTemplate}>
          Download template
        </button>
      </div>

      <div className="inv-two">
        <div className="inv-card">
          <h3>Upload file</h3>
          {template && (
            <p className="inv-muted">
              Columns marked <span className="inv-req">*</span> in the template are mandatory:{' '}
              {template.requiredHeaders.join(', ')}.
              {template.productionMode
                ? ''
                : ' Set PRODUCTION_MODE=on to require every column.'}
            </p>
          )}
          <FilePicker
            label="CSV file"
            hint="Download the template, fill it, then drop it here."
            accept=".csv,text/csv"
            files={csvFile}
            onChange={onFiles}
            maxFiles={1}
            multiple={false}
            dropSub="CSV only · one file"
          />
          {csv ? <p className="inv-muted">{dataRows} data rows ready to import</p> : null}
          <button type="button" className="btn primary" disabled={!csv || busy} onClick={handleImport}>
            {busy ? 'Importing…' : 'Import valid rows'}
          </button>
        </div>
        <div className="inv-card">
          <h3>Last import</h3>
          {result ? (
            <dl className="inv-meta">
              <div>
                <dt>Imported</dt>
                <dd>{result.imported}</dd>
              </div>
              <div>
                <dt>Errors</dt>
                <dd>{result.errors?.length || 0}</dd>
              </div>
            </dl>
          ) : (
            <p className="inv-muted">No import yet this session.</p>
          )}
        </div>
      </div>

      {result?.errors?.length > 0 && (
        <div className="inv-card" style={{ marginTop: 14 }}>
          <h3>Errors</h3>
          <table className="inv-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((item) => (
                <tr key={item.row}>
                  <td>{item.row}</td>
                  <td>{item.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
