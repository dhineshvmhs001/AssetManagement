import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getEmployee, getEmployeeFileUrl } from '../../api/employees.api';
import { listTickets } from '../../api/tickets.api';

export default function EmployeeDetails() {
  const { code } = useParams();
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState(null);
  const [fileUrls, setFileUrls] = useState({});
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    getEmployee(code).then((data) => {
      if (!data.ok) {
        setError(data.error || 'Employee not found');
        return;
      }
      setEmployee(data.employee);
      listTickets({ employee: data.employee.employeeCode, limit: 50 }).then((res) => {
        if (res.ok) {
          setTickets(res.tickets || []);
        }
      });
    });
  }, [code]);

  useEffect(() => {
    if (!employee) {
      return undefined;
    }
    const paths = (employee.documents || []).map((file) => file.path).filter(Boolean);
    if (!paths.length) {
      return undefined;
    }

    let live = true;
    const made = [];
    Promise.all(
      paths.map((path) => getEmployeeFileUrl(path).then((url) => {
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
  }, [employee]);

  if (error) {
    return <p className="inv-error">{error}</p>;
  }
  if (!employee) {
    return <p className="inv-muted">Loading…</p>;
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>
            {employee.employeeCode} · {employee.name}
          </h2>
          <p>Person record used on HR tickets and assignment.</p>
        </div>
        <div className="inv-head-actions">
          <Link className="btn ghost" to={`/employees/${employee.employeeCode}/edit`}>
            Edit
          </Link>
        </div>
      </div>

      <div className="inv-card">
        <h3>Profile</h3>
        <dl className="inv-meta">
          <div>
            <dt>Employee ID</dt>
            <dd>{employee.employeeCode}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{employee.name}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{employee.department || '—'}</dd>
          </div>
          <div>
            <dt>Designation</dt>
            <dd>{employee.designation || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{employee.email || '—'}</dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{employee.mobile || '—'}</dd>
          </div>
          <div>
            <dt>Joining date</dt>
            <dd>{employee.joiningDate || '—'}</dd>
          </div>
          <div>
            <dt>Manager</dt>
            <dd>
              {employee.managerName
                ? `${employee.managerName} · ${employee.managerEmail || ''}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{employee.location || '—'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`st st-${employee.status.toLowerCase()}`}>{employee.statusLabel}</span>
            </dd>
          </div>
          <div>
            <dt>Assets held</dt>
            <dd>{employee.assetCount ?? 0}</dd>
          </div>
          <div>
            <dt>Documents</dt>
            <dd>
              {employee.documents?.length ? (
                <ul className="inv-file-links">
                  {employee.documents.map((file) => (
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
            </dd>
          </div>
          <div>
            <dt>Created by</dt>
            <dd>{employee.createdBy || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="inv-card">
        <h3>Current assigned assets</h3>
        <p className="inv-muted">None yet. This fills after Assignment is built.</p>
      </div>

      <div className="inv-card">
        <h3>HR tickets</h3>
        {tickets.length ? (
          <table className="inv-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Need</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link to={`/tickets/${ticket.ticketCode}`}>{ticket.ticketCode}</Link>
                  </td>
                  <td>
                    {ticket.category} × {ticket.quantity}
                  </td>
                  <td>{ticket.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="inv-muted">None yet.</p>
        )}
      </div>
    </section>
  );
}
