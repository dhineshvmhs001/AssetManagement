import { useEffect, useState } from 'react';
import { getEmployeeTemplate, importEmployees } from '../../api/employees.api';
import { notify } from '../../ui/notify';
import FilePicker from '../inventory/FilePicker';

function isSpreadsheet(file) {
  const name = String(file?.name || '').toLowerCase();
  return ['.xlsx', '.xls', '.ods', '.fods', '.ots'].some((ext) => name.endsWith(ext));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const comma = text.indexOf(',');
      resolve(comma >= 0 ? text.slice(comma + 1) : text);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function downloadBase64(base64, filename, type) {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportEmployees() {
  const [payload, setPayload] = useState(null);
  const [csvFile, setCsvFile] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState(null);

  useEffect(() => {
    getEmployeeTemplate().then((data) => {
      if (data.ok) {
        setTemplate(data);
      }
    });
  }, []);

  async function downloadTemplate() {
    const data = template?.ok ? template : await getEmployeeTemplate();
    if (!data.ok || !data.xlsx) {
      notify.error(data.error || 'Could not download template');
      return;
    }
    downloadBase64(
      data.xlsx,
      data.filename || 'employees_template.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }

  async function onFiles(next) {
    const file = next[0];
    setCsvFile(file ? [file] : []);
    setResult(null);
    if (!file) {
      setPayload(null);
      return;
    }
    if (!file.size) {
      setPayload(null);
      notify.error('The file is empty');
      return;
    }
    if (isSpreadsheet(file)) {
      setPayload({ xlsx: await fileToBase64(file) });
    } else {
      const text = await file.text();
      if (!text.trim()) {
        setPayload(null);
        notify.error('The file is empty');
        return;
      }
      setPayload({ csv: text });
    }
    notify.success('File loaded', 'Click import when you are ready.');
  }

  async function handleImport() {
    if (!payload) {
      notify.error('The file is empty');
      return;
    }
    setBusy(true);
    const data = await importEmployees(payload);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Import failed');
      return;
    }
    setResult(data);
    const skipped = data.skipped?.length || 0;
    const failed = data.errors?.length || 0;
    if (failed || skipped) {
      notify.error(
        `Imported ${data.imported}` +
          (skipped ? `, skipped ${skipped} duplicate id(s)` : '') +
          (failed ? `, ${failed} row(s) failed` : ''),
      );
    } else {
      notify.success(`Imported ${data.imported} employees`);
    }
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Bulk import</h2>
          <p>
            Download the Excel template, fill every column, then upload. Column names and order must
            match. Duplicate employee id rows are skipped.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={downloadTemplate}>
          Download template
        </button>
      </div>

      <div className="inv-two">
        <div className="inv-card">
          <h3>Upload file</h3>
          {template?.headers && (
            <p className="inv-muted">
              Required columns: {template.headers.join(', ')}. Employee ID: MHS plus numbers (MHS101),
              stored in capitals. Department: Sales, Operations, Support,
              HR. Status: Active or Inactive. Date: YYYY-MM-DD. Manager email must already exist as a
              Manager user. LibreOffice may ask to save as .ods — that file is fine to upload.
            </p>
          )}
          <FilePicker
            label="Excel file"
            hint="Download the template, fill it, then drop it here."
            accept=".xlsx,.xls,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,text/csv"
            files={csvFile}
            onChange={onFiles}
            maxFiles={1}
            multiple={false}
            dropSub="Excel, ODS, or CSV · one file"
          />
          {payload ? <p className="inv-muted">File ready to import</p> : null}
          <button type="button" className="btn primary" disabled={!payload || busy} onClick={handleImport}>
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
                <dt>Skipped</dt>
                <dd>{result.skipped?.length || 0}</dd>
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

      {result?.skipped?.length > 0 && (
        <div className="inv-card" style={{ marginTop: 14 }}>
          <h3>Skipped duplicates</h3>
          <table className="inv-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {result.skipped.map((item) => (
                <tr key={`skip-${item.row}`}>
                  <td>{item.row}</td>
                  <td>{item.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                <tr key={`err-${item.row}`}>
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
