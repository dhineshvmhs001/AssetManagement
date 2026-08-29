import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listTickets, decideTicket } from '../../api/tickets.api';
import { useAuth } from '../../auth/AuthProvider';
import { notify } from '../../ui/notify';

const EMPTY = { search: '', status: '' };
const PAGE_SIZE = 20;

const COLUMNS = [
  { key: 'ticketCode', label: 'Ticket ID' },
  { key: 'employeeName', label: 'Employee' },
  { key: 'itemsLabel', label: 'Requested' },
  { key: 'needDate', label: 'Need date' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
];

const EMPTY_DATA = { tickets: [], total: 0, page: 1, pages: 1 };

export default function TicketList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(EMPTY_DATA);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    listTickets({ ...filters, page, limit: PAGE_SIZE }).then((res) => {
      if (res.ok) {
        setData(res);
        setSelected(0);
      }
    });
  }, [filters.search, filters.status, page]);

  function set(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  async function decide(ticket, action) {
    setBusy(ticket.id);
    const data = await decideTicket(ticket.ticketCode, action);
    setBusy(null);
    if (!data.ok) {
      notify.error(data.error || 'Could not update ticket');
      return;
    }
    notify.success(
      action === 'approve' ? `${ticket.ticketCode} approved` : `${ticket.ticketCode} not approved`,
    );
    listTickets({ ...filters, page, limit: PAGE_SIZE }).then((res) => {
      if (res.ok) {
        setData(res);
      }
    });
  }

  const pages = data.pages || 1;
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data.total);

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>{isManager ? 'Team tickets' : 'Ticket list'}</h2>
          <p>
            {isManager
              ? 'Requests for people who report to you. Approve or reject here, or use the email links.'
              : 'HR asset requests. Create the employee first, then raise a ticket.'}
          </p>
        </div>
        {isManager ? null : (
          <Link className="btn primary" to="/tickets/add" tabIndex={-1}>
            Create ticket
          </Link>
        )}
      </div>

      <div className="inv-toolbar">
        <input
          className="inv-search"
          placeholder="Search ticket ID, employee…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
        <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="AWAITING_MANAGER">Awaiting manager approval</option>
          <option value="WITH_ASSET_MANAGER">With Asset Manager</option>
          <option value="WITH_ASSET_TEAM">Assigned to Asset Team</option>
          <option value="CLOSED">Closed</option>
          <option value="REJECTED">Not approved</option>
        </select>
      </div>

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              {isManager ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {data.tickets.map((ticket, index) => (
              <tr
                key={ticket.id}
                className={index === selected ? 'is-selected' : undefined}
                onClick={() => setSelected(index)}
                onDoubleClick={() => navigate(`/tickets/${ticket.ticketCode}`)}
              >
                <td>
                  <Link to={`/tickets/${ticket.ticketCode}`} tabIndex={-1}>
                    {ticket.ticketCode}
                  </Link>
                </td>
                <td>{ticket.employeeName || '—'}</td>
                <td>{ticket.itemsLabel || ticket.category || '—'}</td>
                <td>{ticket.needDate || '—'}</td>
                <td>{ticket.priorityLabel || ticket.priority || '—'}</td>
                <td>
                  <span className={`st st-${String(ticket.status || '').toLowerCase()}`}>{ticket.statusLabel}</span>
                </td>
                {isManager ? (
                  <td>
                    {ticket.canDecide ? (
                      <span className="inv-actions">
                        <button
                          type="button"
                          className="btn primary"
                          disabled={busy === ticket.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            decide(ticket, 'approve');
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={busy === ticket.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            decide(ticket, 'reject');
                          }}
                        >
                          Reject
                        </button>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {!data.tickets.length && (
              <tr>
                <td colSpan={COLUMNS.length + (isManager ? 1 : 0)} className="inv-empty">
                  {isManager
                    ? 'No tickets for your team yet.'
                    : 'No tickets yet. HR creates one after the employee exists.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="inv-pager">
        <p className="inv-count">
          {data.total ? `${from}–${to} of ${data.total} tickets` : '0 tickets'}
        </p>
        <div className="inv-pager-btns">
          <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </button>
          <span className="inv-muted">
            Page {page} of {pages}
          </span>
          <button type="button" className="btn ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
