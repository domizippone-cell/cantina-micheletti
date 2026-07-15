import React from 'react';
import { CATEGORIES } from '../config.js';
import { chiaveMese, etichettaMese } from '../date.js';

export const FILTRI_VUOTI = { testo: '', tipo: '', categoria: '', mese: '' };

// Applica i filtri alle righe. Il campo di testo cerca dentro controparte,
// P.IVA, nome del file, date e importo totale (scritto con punto o virgola).
export function filtraRighe(rows, filtri) {
  const testo = filtri.testo.trim().toLowerCase();
  return rows.filter((r) => {
    if (filtri.tipo && r.tipo !== filtri.tipo) return false;
    if (filtri.categoria && r.categoria !== filtri.categoria) return false;
    if (filtri.mese && chiaveMese(r.data) !== filtri.mese) return false;
    if (testo) {
      const totale = (Number(r.totale) || 0).toFixed(2);
      const pagliaio = [
        r.controparte,
        r.partita_iva,
        r.fileName,
        r.data,
        r.scadenza,
        totale,
        totale.replace('.', ','),
      ]
        .join(' ')
        .toLowerCase();
      if (!pagliaio.includes(testo)) return false;
    }
    return true;
  });
}

export default function Filtri({ filtri, onChange, mesi }) {
  const attivi = filtri.testo || filtri.tipo || filtri.categoria || filtri.mese;
  const set = (campo) => (e) => onChange({ ...filtri, [campo]: e.target.value });

  return (
    <div className="filtri">
      <input
        className="filtro-testo"
        type="search"
        placeholder="🔎 Cerca fornitore, importo, P.IVA…"
        value={filtri.testo}
        onChange={set('testo')}
      />
      <select className="filtro-select" value={filtri.tipo} onChange={set('tipo')}>
        <option value="">Acquisti e vendite</option>
        <option value="acquisto">Solo acquisti</option>
        <option value="vendita">Solo vendite</option>
      </select>
      <select className="filtro-select" value={filtri.categoria} onChange={set('categoria')}>
        <option value="">Tutte le categorie</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select className="filtro-select" value={filtri.mese} onChange={set('mese')}>
        <option value="">Tutti i mesi</option>
        {mesi.map((m) => (
          <option key={m} value={m}>
            {etichettaMese(m)}
          </option>
        ))}
      </select>
      {attivi && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange(FILTRI_VUOTI)}>
          ✕ Pulisci
        </button>
      )}
    </div>
  );
}
