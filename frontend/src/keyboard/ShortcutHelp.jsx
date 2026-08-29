import './ShortcutHelp.css';

const ROWS = [
  ['Tab / Shift+Tab', 'Switch sidebar modules'],
  ['↑ / ↓ / ← / →', 'Next or previous form field (on forms). List rows and Inventory tabs otherwise'],
  ['Enter', 'Open the selected asset row'],
  ['/', 'Focus search'],
  ['g then d', 'Dashboard'],
  ['g then i', 'Inventory'],
  ['g then v / a / m / e / t / l / r', 'Vendors, Assignment, Maintenance, Employees, Tickets, Activity, Reports'],
  ['n', 'Add asset (in Inventory)'],
  ['Esc', 'Close this help, or back to asset list'],
  ['?', 'Toggle this list'],
];

export default function ShortcutHelp({ onClose }) {
  return (
    <div className="kbd-help" role="dialog" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="kbd-help-card" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard</h2>
        <table>
          <tbody>
            {ROWS.map(([keys, meaning]) => (
              <tr key={keys}>
                <th>{keys}</th>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="kbd-help-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
