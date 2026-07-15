import React from 'react';
import { chiaveMese, etichettaMese } from '../date.js';

const euroFormat = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmt = (v) => euroFormat.format(Number(v) || 0) + ' €';

function etichetta(chiave) {
  return chiave === 'senza-data' ? 'Senza data' : etichettaMese(chiave);
}

export default function Riepilogo({ rows }) {
  const gruppi = new Map();
  for (const r of rows) {
    if (r.status !== 'done') continue;
    const k = chiaveMese(r.data) || 'senza-data';
    if (!gruppi.has(k)) {
      gruppi.set(k, { vendite: 0, acquisti: 0, conteggio: 0, categorie: new Map() });
    }
    const g = gruppi.get(k);
    const tot = Number(r.totale) || 0;
    if (r.tipo === 'vendita') g.vendite += tot;
    else g.acquisti += tot;
    g.conteggio += 1;
    const cat = r.categoria || 'Altro';
    g.categorie.set(cat, (g.categorie.get(cat) || 0) + tot);
  }

  if (gruppi.size === 0) {
    return (
      <div className="empty">
        <p>Nessun documento da riepilogare.</p>
        <p className="empty-hint">Carica qualche fattura e qui troverai i totali mese per mese.</p>
      </div>
    );
  }

  const chiavi = [...gruppi.keys()].sort((a, b) =>
    a === 'senza-data' ? 1 : b === 'senza-data' ? -1 : b.localeCompare(a)
  );

  return (
    <div className="riepilogo">
      {chiavi.map((k) => {
        const g = gruppi.get(k);
        const saldo = g.vendite - g.acquisti;
        return (
          <div className="mese" key={k}>
            <div className="mese-testa">
              <h3>{etichetta(k)}</h3>
              <span className={'mese-saldo' + (saldo < 0 ? ' negativo' : '')}>
                Saldo {saldo >= 0 ? '+' : '−'} {fmt(Math.abs(saldo))}
              </span>
            </div>
            <div className="mese-totali">
              <span className="stat stat-vendite">Vendite {fmt(g.vendite)}</span>
              {' · '}
              <span className="stat stat-acquisti">Acquisti {fmt(g.acquisti)}</span>
              {' · '}
              {g.conteggio} {g.conteggio === 1 ? 'documento' : 'documenti'}
            </div>
            <ul className="mese-categorie">
              {[...g.categorie.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([cat, val]) => (
                  <li key={cat}>
                    <span>{cat}</span>
                    <span>{fmt(val)}</span>
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
