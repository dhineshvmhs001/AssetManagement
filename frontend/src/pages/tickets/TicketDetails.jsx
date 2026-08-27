import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTicket, getTicketFileUrl } from '../../api/tickets.api';

export default function TicketDetails() {
  const { code } = useParams();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);
  const [fileUrls, setFileUrls] = useState({});

  useEffect(() => {
    getTicket(code).then((data) => {
      if (!data.ok) {
        setError(data.error || 'Ticket not found');
        return;
      }
      setTicket(data.ticket);
    });
  }, [code]);

  useEffect(() => {
    if (!ticket) {
      return undefined;
    }
    const paths = (ticket.attachments || []).map((file) => file.path).filter(Boolean);
    if (!paths.length) {
      return undefined;
    }

    let live = true;
    const made = [];
    Promise.all(
      paths.map((path) => getTicketFileUrl(path).then((url) => {
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
  }, [ticket]);

  if (error) {
    return <p className="inv-error">{error}</p>;
  }
  if (!ticket) {
    return <p className="inv-muted">Loading…</p>;
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>
            {ticket.ticketCode} · {ticket.employeeName || 'Ticket'}
          </h2>
          <p>HR request. Manager approval email is not sent yet. Assignment comes next.</p>
        </div>
        <div className="inv-head-actions">
          <Link className="btn ghost" to="/tickets">
            Back to list
          </Link>
        </div>
      </div>

      <div className="inv-card">
        <h3>Request</h3>
        <dl className="inv-meta">
          <div>
            <dt>Ticket ID</dt>
            <dd>{ticket.ticketCode}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`st st-${String(ticket.status || '').toLowerCase()}`}>{ticket.statusLabel}</span>
            </dd>
          </div>
          <div>
            <dt>Employee</dt>
            <dd>
              {ticket.employeeCode ? (
                <Link to={`/employees/${ticket.employeeCode}`}>
                  {ticket.employeeCode} · {ticket.employeeName}
                </Link>
              ) : (
                ticket.employeeName || '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{ticket.department || '—'}</dd>
          </div>
          <div>
            <dt>Joining date</dt>
            <dd>{ticket.joiningDate || '—'}</dd>
          </div>
          <div>
            <dt>Manager</dt>
            <dd>
              {ticket.managerName
                ? `${ticket.managerName}${ticket.managerEmail ? ` · ${ticket.managerEmail}` : ''}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Asset category</dt>
            <dd>{ticket.category || '—'}</dd>
          </div>
          <div>
            <dt>Quantity</dt>
            <dd>{ticket.quantity ?? '—'}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{ticket.priorityLabel || ticket.priority || '—'}</dd>
          </div>
          <div>
            <dt>Need date</dt>
            <dd>{ticket.needDate || '—'}</dd>
          </div>
          <div>
            <dt>Remarks</dt>
            <dd>{ticket.remarks || '—'}</dd>
          </div>
          <div>
            <dt>Attachments</dt>
            <dd>
              {ticket.attachments?.length ? (
                <ul className="inv-file-links">
                  {ticket.attachments.map((file) => (
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
            <dd>{ticket.createdBy || '—'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
