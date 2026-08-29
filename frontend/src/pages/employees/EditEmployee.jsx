import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEmployee, updateEmployee } from '../../api/employees.api';
import { notify } from '../../ui/notify';
import EmployeeForm from './EmployeeForm';

export default function EditEmployee() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getEmployee(code).then((data) => {
      if (!data.ok) {
        setError(data.error || 'Employee not found');
        return;
      }
      setEmployee(data.employee);
    });
  }, [code]);

  const initial = useMemo(() => {
    if (!employee) {
      return null;
    }
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name || '',
      department: employee.department || '',
      designation: employee.designation || '',
      email: employee.email || '',
      mobile: employee.mobile || '',
      joiningDate: employee.joiningDate || '',
      managerId: employee.managerId || '',
      location: employee.location || '',
      status: employee.status || 'ACTIVE',
    };
  }, [employee]);

  async function handleSubmit(form, blocked, files) {
    if (blocked) {
      notify.error(blocked);
      return;
    }
    const editable = { ...form };
    delete editable.employeeCode;
    delete editable.id;
    setBusy(true);
    const data = await updateEmployee(code, editable, files);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not update employee');
      return;
    }
    notify.success(`Employee ${data.employee.employeeCode} updated`);
    navigate(`/employees/${data.employee.employeeCode}`);
  }

  if (error) {
    return <p className="inv-error">{error}</p>;
  }
  if (!initial) {
    return <div className="page-wait" aria-busy="true" />;
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Edit {employee.employeeCode}</h2>
          <p>Employee ID cannot be changed. New documents are added to the existing ones.</p>
        </div>
      </div>

      <EmployeeForm
        initial={initial}
        existingFiles={{ documents: employee.documents || [] }}
        submitLabel="Save changes"
        busy={busy}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/employees/${code}`)}
      />
    </section>
  );
}
