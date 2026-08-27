import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTicket } from '../../api/tickets.api';
import { notify } from '../../ui/notify';
import TicketForm from './TicketForm';

export default function CreateTicket() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(form, blocked, files) {
    if (blocked) {
      notify.error(blocked);
      return;
    }
    setBusy(true);
    const data = await createTicket(form, files);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not create ticket');
      return;
    }
    notify.success(`Ticket ${data.ticket.ticketCode} created`);
    navigate(`/tickets/${data.ticket.ticketCode}`);
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Create ticket</h2>
          <p>HR asset request. A Ticket ID (TK-2026-0001…) is created automatically on save.</p>
        </div>
      </div>

      <TicketForm
        busy={busy}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/tickets')}
      />
    </section>
  );
}
