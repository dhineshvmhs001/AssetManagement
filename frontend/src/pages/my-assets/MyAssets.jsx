import { useEffect, useState } from 'react';
import { getAssignmentFileUrl, listMyAssignments } from '../../api/assignments.api';
import { useAuth } from '../../auth/AuthProvider';
import '../inventory/Inventory.css';

export default function MyAssets() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [fileUrls, setFileUrls] = useState({});

  useEffect(() => {
    listMyAssignments().then((res) => {
      if (res.ok) {
        setAssignments(res.assignments || []);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    const paths = assignments.flatMap((row) => (row.documents || []).map((file) => file.path).filter(Boolean));
    if (!paths.length) {
      setFileUrls({});
      return undefined;
    }
    let live = true;
    const made = [];
    Promise.all(
      paths.map((path) => getAssignmentFileUrl(path).then((url) => {
        if (url) {
          made.push(url);
        }
        return [path, url];
      })),
    ).then((pairs) => {
      if (live) {
        setFileUrls(Object.fromEntries(pairs.filter(([, url]) => url)));
      }
    });
    return () => {
      live = false;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [assignments]);

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>My assets</h2>
          <p>What is currently assigned to you.</p>
        </div>
      </div>
      <div className="inv-card">
        <p>
          Signed in as <strong>{user?.name}</strong> ({user?.email}).
        </p>
        {loaded && !assignments.length ? (
          <p className="inv-muted">Nothing assigned to you yet.</p>
        ) : null}
        {assignments.length ? (
          <table className="inv-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Assigned</th>
                <th>Return by</th>
                <th>Proof</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.assetCode}
                    <div className="inv-muted">
                      {row.category} · {row.brand} {row.model || ''}
                    </div>
                  </td>
                  <td>{row.assignedAt || '—'}</td>
                  <td>{row.expectedReturn || '—'}</td>
                  <td>
                    {row.documents?.length ? (
                      <ul className="inv-file-links">
                        {row.documents.map((file) => (
                          <li key={file.stored || file.name}>
                            {fileUrls[file.path] ? (
                              <a href={fileUrls[file.path]} target="_blank" rel="noreferrer">
                                {file.name}
                              </a>
                            ) : (
                              file.name
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  );
}
