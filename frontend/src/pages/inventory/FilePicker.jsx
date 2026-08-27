import { useEffect, useState } from 'react';
import { notify } from '../../ui/notify';

const MAX_BYTES = 8 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilePicker({
  label,
  hint,
  accept,
  files,
  onChange,
  showPreview,
  required,
  alreadyStored = 0,
  maxFiles = 8,
  multiple = true,
  wide = false,
  dropSub = 'PDF, Word, or image · up to 8 files · 8 MB each',
}) {
  const [previews, setPreviews] = useState([]);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const next = files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setPreviews(next);
    return () => next.forEach((item) => item.url && URL.revokeObjectURL(item.url));
  }, [files]);

  const room = maxFiles - alreadyStored - files.length;
  const canAdd = maxFiles === 1 || room > 0;

  function take(picked) {
    if (!picked.length) {
      return;
    }

    const tooBig = picked.filter((file) => file.size > MAX_BYTES);
    if (tooBig.length) {
      notify.error(`${tooBig[0].name} is over 8 MB`);
    }

    const sized = picked.filter((file) => file.size <= MAX_BYTES);
    if (sized.length > room && maxFiles > 1) {
      notify.error(
        room > 0
          ? `Only ${room} more file${room === 1 ? '' : 's'} can be added (${maxFiles} max)`
          : `${label} is full — ${maxFiles} files max`,
      );
    }
    if (maxFiles === 1) {
      if (sized.length) {
        onChange(sized.slice(0, 1));
      }
      return;
    }
    if (room > 0) {
      onChange([...files, ...sized.slice(0, room)]);
    }
  }

  function add(event) {
    take(Array.from(event.target.files || []));
    event.target.value = '';
  }

  function onDrop(event) {
    event.preventDefault();
    setOver(false);
    if (room <= 0 && maxFiles !== 1) {
      return;
    }
    take(Array.from(event.dataTransfer.files || []));
  }

  return (
    <div className={`inv-file${wide ? ' is-wide' : ''}`}>
      <span className="inv-file-label">
        {label}
        {required ? <span className="inv-req"> *</span> : null}
      </span>
      <span className="inv-file-hint">
        {hint}
        {alreadyStored > 0 ? ` ${alreadyStored} already saved.` : ''}
      </span>

      <label
        className={`inv-drop${over ? ' is-over' : ''}${canAdd ? '' : ' is-disabled'}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (canAdd) {
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input type="file" accept={accept} multiple={multiple} onChange={add} disabled={!canAdd} />
        <span className="inv-drop-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16V7m0 0 3.5 3.5M12 7 8.5 10.5M5 16.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="inv-drop-title">
          {canAdd ? (
            <>
              Drop files here or <em>browse</em>
            </>
          ) : (
            'Limit reached'
          )}
        </span>
        <span className="inv-drop-sub">{dropSub}</span>
      </label>

      {!files.length && alreadyStored === 0 && <span className="inv-muted">No files selected yet</span>}
      {!!files.length && (
        <ul className="inv-file-list">
          {previews.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              {showPreview && item.url ? (
                <img src={item.url} alt="" />
              ) : (
                <span className="inv-file-badge">{item.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}</span>
              )}
              <span className="inv-file-meta">
                <strong>{item.name}</strong>
                <small>{formatSize(item.size)}</small>
              </span>
              <button
                type="button"
                className="inv-file-remove"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
