import React from 'react';
import { CATEGORIES } from '../config.js';
import { chiaveMese, etichettaMese, parseData, parseISO } from '../date.js';
import { insiemeProblemi } from '../calcoli.js';

export const FILTRI_VUOTI = {
  testo: '', tipo: '', categoria: '', mese: '', da: '', a: '', daControllare: false,
};

// Applica i filtri alle righe. Il campo di testo cerca dentro controparte,
// P.IVA, nome del file, date e importo totale (scritto con punto o virgola).
export function filtraRighe(rows, filtri) {
  const testo = filtri.testo.trim().toLowerCase();
  const da = parseISO(filtri.da);
  const a = parseISO(filtri.a);
  // L'insieme "da controllare" dipende da tutte le righe (i doppioni sono
  // relativi): calcolalo una volta sola, solo se il filtro è attivo.
  const problemi = filtri.daControllare ? insiemeProblemi(rows) : null;
  return rows.filter((r) => {
    if (filtri.tipo && r.tipo !== filtri.tipo) return false;
    if (filtri.categoria && r.categoria !== filtri.categoria) return false;
    if (filtri.mese && chiaveMese(r.data) !== filtri.mese) return false;
    if (problemi && !problemi.has(r.id)) return false;
    if (da || a) {
      const d = parseData(r.data);
      if (!d) return false;
      if (da && d < da) return false;
      if (a && d > a) return false;
    }
    if (testo) {
      const totale = (Number(r.totale) || 0).toFixed(2);
      const pagliaio = [
        r.controparte,
        r.partita_iva,
        r.fileName,
        r.data,
        r.scadenza,
        r.nota,
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

export function filtriAttivi(filtri) {
  return !!(
    filtri.testo.trim() || filtri.tipo || filtri.categoria || filtri.mese ||
    filtri.da || filtri.a || filtri.daControllare
  );
}

export default function Filtri({ filtri, onChange, mesi, nProblemi = 0 }) {
  const attivi = filtriAttivi(filtri);
  const set = (campo) => (e) => onChange({ ...filtri, [campo]: e.target.value });

  return (
    <div className="filtri">
      <input
        className="filtro-testo"
        type="search"
        placeholder="🔎 Cerca fornitore, importo, P.IVA, note…"
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
      <label className="filtro-data">
        dal
        <input type="date" className="filtro-select" value={filtri.da} onChange={set('da')} />
      </label>
      <label className="filtro-data">
        al
        <input type="date" className="filtro-select" value={filtri.a} onChange={set('a')} />
      </label>
      <button
        className={'btn btn-sm filtro-controlla' + (filtri.daControllare ? ' attivo' : '')}
        onClick={() => onChange({ ...filtri, daControllare: !filtri.daControllare })}
        title="Mostra solo i documenti con un avviso: conti che non tornano, doppioni, errori"
      >
        ⚠ Da controllare{nProblemi > 0 ? ` (${nProblemi})` : ''}
      </button>
      {attivi && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange(FILTRI_VUOTI)}>
          ✕ Pulisci
        </button>
      )}
    </div>
  );
}
