import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listEmployees } from '../../api/employees.api';
import { Field, FilterRow, Input, Select } from '../../ui';

const EMPTY = { search: '', status: '', assetsHeld: '' };
const PAGE_SIZE = 20;

const COLUMNS = [
  { key: 'employeeCode', label: 'Employee ID' },
  { key: 'name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'managerName', label: 'Manager' },
  { key: 'location', label: 'Location' },
  { key: 'assetCount', label: 'Assets' },
  { key: 'status', label: 'Status' },
];

const EMPTY_DATA = { employees: [], total: 0, page: 1, pages: 1 };

export default function EmployeeList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(EMPTY_DATA);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    listEmployees({ ...filters, page, limit: PAGE_SIZE }).then((res) => {
      if (res.ok) {
        setData(res);
        setSelected(0);
      }
    });
  }, [filters.search, filters.status, filters.assetsHeld, page]);

  function set(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const pages = data.pages || 1;
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data.total);

  return (
    <section>
      <div className="inv-head">
        <p>Add the person first. HR tickets and assignment pick from this list.</p>
        <div className="inv-actions">
          <Link className="btn ghost" to="/employees/import" tabIndex={-1}>
            Bulk import
          </Link>
          <Link className="btn primary" to="/employees/add" tabIndex={-1}>
            Add employee
          </Link>
        </div>
      </div>

      <FilterRow>
        <Field label="Search" style={{ flex: '1 1 240px' }}>
          <Input
            placeholder="Search employee ID, name, email…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
          />
        </Field>
        <Field label="Status" style={{ flex: '0 1 180px' }}>
          <Select value={filters.status} onChange={(e) => set('status', e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </Field>
        <Field label="Holdings" style={{ flex: '0 1 180px' }}>
          <Select value={filters.assetsHeld} onChange={(e) => set('assetsHeld', e.target.value)} aria-label="Filter by holdings">
            <option value="">All holdings</option>
            <option value="with">With assets</option>
            <option value="without">Without assets</option>
          </Select>
        </Field>
      </FilterRow>

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.employees.map((employee, index) => (
              <tr
                key={employee.id}
                className={index === selected ? 'is-selected' : undefined}
                onClick={() => setSelected(index)}
                onDoubleClick={() => navigate(`/employees/${employee.employeeCode}`)}
              >
                <td>
                  <Link to={`/employees/${employee.employeeCode}`} tabIndex={-1}>
                    {employee.employeeCode}
                  </Link>
                </td>
                <td>{employee.name}</td>
                <td>{employee.department || '—'}</td>
                <td>{employee.designation || '—'}</td>
                <td>{employee.managerName || '—'}</td>
                <td>{employee.location || '—'}</td>
                <td>{employee.assetCount ?? 0}</td>
                <td>
                  <span className={`st st-${employee.status.toLowerCase()}`}>{employee.statusLabel}</span>
                </td>
              </tr>
            ))}
            {!data.employees.length && (
              <tr>
                <td colSpan={COLUMNS.length} className="inv-empty">
                  No employees yet. Add one before HR tickets or assignment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="inv-pager">
        <p className="inv-count">
          {data.total ? `${from}–${to} of ${data.total} employees` : '0 employees'}
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
