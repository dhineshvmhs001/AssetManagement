import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmployee } from '../../api/employees.api';
import { notify } from '../../ui/notify';
import EmployeeForm from './EmployeeForm';

export default function AddEmployee() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(form, blocked, files) {
    if (blocked) {
      notify.error(blocked);
      return;
    }
    setBusy(true);
    const data = await createEmployee(form, files);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not save employee');
      return;
    }
    notify.success(`Employee ${data.employee.employeeCode} saved`);
    if (data.login?.created && data.login.temporaryPassword) {
      notify.success(`Login created: ${data.login.email} / ${data.login.temporaryPassword}`);
    } else if (data.login?.email) {
      notify.success(`Login already exists for ${data.login.email}`);
    }
    navigate(`/employees/${data.employee.employeeCode}`);
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Add employee</h2>
          <p>Fill the person details. Employee ID must be MHS plus numbers, like MHS101. Capitals are stored automatically.</p>
        </div>
      </div>

      <EmployeeForm
        submitLabel="Save employee"
        busy={busy}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/employees')}
      />
    </section>
  );
}
