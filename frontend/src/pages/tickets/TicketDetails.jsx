import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTicket, getTicketFileUrl, decideTicket, dispatchTicket } from '../../api/tickets.api';
import { useAuth } from '../../auth/AuthProvider';
import { notify } from '../../ui/notify';

function introFor(role) {
  if (role === 'MANAGER') {
    return 'Request for someone on your team. Approve or reject here; the same action is in the email.';
  }
  if (role === 'ASSET_MANAGER') {
    return 'After the manager approves, send the query to Asset Team. They assign the physical asset to the employee.';
  }
  if (role === 'ASSET_TEAM') {
    return 'When Asset Manager sends a ticket to the team, assign matching stock on Assignment.';
  }
  if (role === 'ADMIN') {
    return 'Manager approves, Asset Manager (or you) sends it to Asset Team, then stock is assigned on Assignment.';
  }
  return 'HR request. Manager approves, Asset Manager sends it to Asset Team, then the team assigns stock.';
}

export default function TicketDetails() {
  const { code } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);
  const [fileUrls, setFileUrls] = useState({});
  const [busy, setBusy] = useState(false);

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

  async function decide(action) {
    setBusy(true);
    const data = await decideTicket(ticket.ticketCode, action);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not update ticket');
      return;
    }
    setTicket(data.ticket);
    notify.success(
      action === 'approve' ? `${ticket.ticketCode} approved` : `${ticket.ticketCode} not approved`,
    );
  }

  async function sendToTeam() {
    setBusy(true);
    const data = await dispatchTicket(ticket.ticketCode);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not send ticket to Asset Team');
      return;
    }
    setTicket(data.ticket);
    notify.success(`${ticket.ticketCode} sent to Asset Team`);
  }

  if (error) {
    return <p className="inv-error">{error}</p>;
  }
  if (!ticket) {
    return <div className="page-wait" aria-busy="true" />;
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>
            {ticket.ticketCode} · {ticket.employeeName || 'Ticket'}
          </h2>
          <p>{introFor(user?.role)}</p>
        </div>
        <div className="inv-head-actions">
          {ticket.canDecide ? (
            <>
              <button type="button" className="btn primary" disabled={busy} onClick={() => decide('approve')}>
                Approve
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => decide('reject')}>
                Reject
              </button>
            </>
          ) : null}
          {ticket.canDispatch ? (
            <button type="button" className="btn primary" disabled={busy} onClick={sendToTeam}>
              Send to Asset Team
            </button>
          ) : null}
          {ticket.canAssignStock ? (
            <Link className="btn primary" to={`/assignment?ticket=${encodeURIComponent(ticket.ticketCode)}`}>
              Assign assets
            </Link>
          ) : null}
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
              {ticket.employeeCode && user?.role !== 'MANAGER' ? (
                <Link to={`/employees/${ticket.employeeCode}`}>
                  {ticket.employeeCode} · {ticket.employeeName}
                </Link>
              ) : (
                ticket.employeeCode
                  ? `${ticket.employeeCode} · ${ticket.employeeName}`
                  : ticket.employeeName || '—'
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
            <dt>Requested assets</dt>
            <dd>
              {ticket.items?.length
                ? ticket.items.map((item) => `${item.category} × ${item.quantity}`).join(', ')
                : ticket.itemsLabel || `${ticket.category || '—'} × ${ticket.quantity ?? '—'}`}
            </dd>
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
          <div>
            <dt>Allocated assets</dt>
            <dd>
              {ticket.allocatedAssets?.length
                ? ticket.allocatedAssets.map((item) => item.assetCode).join(', ')
                : '—'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
