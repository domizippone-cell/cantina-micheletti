import React, { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from '../config.js';

const TIPO_LABELS = { acquisto: 'Acquisto', vendita: 'Vendita' };

const COLUMNS = [
  {
    key: 'tipo',
    label: 'Tipo',
    type: 'select',
    options: ['acquisto', 'vendita'],
    optionLabel: (v) => TIPO_LABELS[v],
    display: (v) => <span className={'tag tag-' + v}>{TIPO_LABELS[v] || v}</span>,
  },
  { key: 'controparte', label: 'Cliente / Fornitore', type: 'text' },
  { key: 'data', label: 'Data', type: 'text' },
  { key: 'partita_iva', label: 'Partita IVA', type: 'text' },
  { key: 'categoria', label: 'Categoria', type: 'select', options: CATEGORIES },
  { key: 'imponibile', label: 'Imponibile', type: 'number' },
  { key: 'iva', label: 'IVA', type: 'number' },
  { key: 'totale', label: 'Totale', type: 'number' },
];

const euroFormat = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatEuro(v) {
  return euroFormat.format(Number(v) || 0) + ' €';
}

// Accetta sia "1.234,56" (formato italiano) sia "1234.56".
function parseImporto(str) {
  const s = String(str).replace(/[€\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(s) || 0;
}

// Se imponibile + IVA non fa il totale, restituisce la somma calcolata
// (con una piccola tolleranza per gli arrotondamenti), altrimenti null.
function sommaChenonQuadra(row) {
  if (row.status !== 'done') return null;
  const imp = Number(row.imponibile) || 0;
  const iva = Number(row.iva) || 0;
  const tot = Number(row.totale) || 0;
  if (!imp && !iva && !tot) return null;
  const somma = imp + iva;
  return Math.abs(somma - tot) > 0.05 ? somma : null;
}

function EditableCell({ value, column, onCommit }) {
  const { type, options, optionLabel, display } = column;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    if (editing && type !== 'select') inputRef.current?.select();
  }, [editing, type]);

  function start() {
    setDraft(
      type === 'number' ? (Number(value) || 0).toFixed(2).replace('.', ',') : String(value ?? '')
    );
    setEditing(true);
  }

  function commit(v) {
    onCommit(type === 'number' ? parseImporto(v) : String(v).trim());
    setEditing(false);
  }

  if (editing && type === 'select') {
    return (
      <select
        ref={inputRef}
        className="cell-select"
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabel ? optionLabel(o) : o}
          </option>
        ))}
      </select>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cell-input"
        value={draft}
        inputMode={type === 'number' ? 'decimal' : 'text'}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft);
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  let content;
  if (display) content = display(value);
  else if (type === 'number') content = formatEuro(value);
  else content = String(value ?? '') || '—';

  return (
    <button
      className={'cell' + (type === 'number' ? ' cell-num' : '')}
      onClick={start}
      title="Clicca per modificare"
    >
      {content}
    </button>
  );
}

function StatusChip({ row, onRetry }) {
  switch (row.status) {
    case 'queued':
      return <span className="chip chip-wait">In coda</span>;
    case 'processing':
      return (
        <span className="chip chip-work">
          <span className="spinner" /> Analisi…
        </span>
      );
    case 'done':
      return <span className="chip chip-ok">✓ Fatto</span>;
    case 'error':
      return (
        <span className="chip chip-err" title={row.error}>
          ⚠ Errore
          <button className="retry" onClick={onRetry}>
            Riprova
          </button>
        </span>
      );
    default:
      return null;
  }
}

export default function DataTable({ rows, onEdit, onRetry, onDelete, onOpenFile }) {
  if (rows.length === 0) {
    return (
      <div className="empty">
        <p>Nessun documento ancora.</p>
        <p className="empty-hint">Trascina una fattura qui sopra per iniziare.</p>
      </div>
    );
  }

  const sum = (key) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Documento</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className={c.type === 'number' ? 'th-num' : ''}>
                {c.label}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const somma = sommaChenonQuadra(row);
            const rowClass =
              row.status === 'error' ? 'row-error' : somma !== null ? 'row-warn' : '';
            return (
              <tr key={row.id} className={rowClass}>
                <td className="td-file">
                  <button
                    className="file-name file-link"
                    title={'Apri il documento originale: ' + row.fileName}
                    onClick={() => onOpenFile(row.id)}
                  >
                    {row.fileName}
                  </button>
                  <StatusChip row={row} onRetry={() => onRetry(row.id)} />
                  {row.status === 'error' && <div className="error-text">{row.error}</div>}
                  {somma !== null && (
                    <div
                      className="check-warn"
                      title={
                        formatEuro(row.imponibile) + ' + ' + formatEuro(row.iva) + ' = ' +
                        formatEuro(somma) + ', ma il Totale indicato è ' + formatEuro(row.totale)
                      }
                    >
                      ⚠ Imponibile + IVA ≠ Totale
                    </div>
                  )}
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={c.type === 'number' ? 'td-num' : ''}>
                    <EditableCell
                      value={row[c.key]}
                      column={c}
                      onCommit={(v) => onEdit(row.id, { [c.key]: v })}
                    />
                  </td>
                ))}
                <td className="td-del">
                  <button
                    className="del"
                    onClick={() => onDelete(row.id)}
                    title="Elimina riga"
                    aria-label={'Elimina ' + row.fileName}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>Totali</td>
            <td className="td-num">{formatEuro(sum('imponibile'))}</td>
            <td className="td-num">{formatEuro(sum('iva'))}</td>
            <td className="td-num">{formatEuro(sum('totale'))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
