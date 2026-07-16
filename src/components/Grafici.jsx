import React, { useState } from 'react';
import { etichettaMese, MESI } from '../date.js';
import { perMese, perCategoria, topControparti } from '../calcoli.js';

const euroFormat = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const euro2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v) => euro2.format(Number(v) || 0) + ' €';
const fmtCorto = (v) => euroFormat.format(Number(v) || 0) + ' €';

// Palette per le categorie della torta (una per categoria, leggibili).
const COLORI = ['#8e2043', '#c26a86', '#3b7a57', '#c9992b', '#4b6ba8', '#7d5ba6', '#9a9a9a'];

// "2026-03" → "Mar 2026", etichetta corta per l'asse del grafico.
function meseCorto(chiave) {
  const [anno, mese] = chiave.split('-');
  return (MESI[Number(mese) - 1] || mese).slice(0, 3) + ' ' + anno.slice(2);
}

// ---- Andamento mensile: barre affiancate vendite/acquisti ----
function Andamento({ rows }) {
  const gruppi = perMese(rows);
  const mesi = [...gruppi.keys()]
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort()
    .slice(-12);

  if (mesi.length === 0) {
    return <p className="graf-vuoto">Servono documenti con una data per vedere l'andamento.</p>;
  }

  const max = Math.max(
    1,
    ...mesi.map((k) => Math.max(gruppi.get(k).vendite, gruppi.get(k).acquisti))
  );
  const W = 640;
  const H = 240;
  const padB = 40; // spazio etichette in basso
  const padT = 10;
  const areaH = H - padB - padT;
  const passo = W / mesi.length;
  const larghezzaBarra = Math.min(18, passo / 3);

  return (
    <div className="graf-blocco">
      <div className="graf-testa">
        <h3>Andamento mensile</h3>
        <div className="graf-legenda">
          <span><i className="pallino" style={{ background: 'var(--ok)' }} /> Vendite</span>
          <span><i className="pallino" style={{ background: 'var(--accent)' }} /> Acquisti</span>
        </div>
      </div>
      <div className="graf-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="graf-svg" role="img" aria-label="Andamento mensile">
          {mesi.map((k, i) => {
            const g = gruppi.get(k);
            const xCentro = i * passo + passo / 2;
            const hV = (g.vendite / max) * areaH;
            const hA = (g.acquisti / max) * areaH;
            const base = padT + areaH;
            return (
              <g key={k}>
                <rect
                  x={xCentro - larghezzaBarra - 1}
                  y={base - hV}
                  width={larghezzaBarra}
                  height={hV}
                  rx="2"
                  fill="var(--ok)"
                >
                  <title>{etichettaMese(k)} · Vendite {fmt(g.vendite)}</title>
                </rect>
                <rect
                  x={xCentro + 1}
                  y={base - hA}
                  width={larghezzaBarra}
                  height={hA}
                  rx="2"
                  fill="var(--accent)"
                >
                  <title>{etichettaMese(k)} · Acquisti {fmt(g.acquisti)}</title>
                </rect>
                <text x={xCentro} y={H - 22} className="graf-asse" textAnchor="middle">
                  {meseCorto(k)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---- Torta (donut) delle categorie ----
function Torta({ rows, mesi }) {
  const [tipo, setTipo] = useState('acquisto');
  const [mese, setMese] = useState('');

  const righeMese = mese
    ? rows.filter((r) => {
        const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(r.data || '').trim());
        return m && m[3] + '-' + m[2].padStart(2, '0') === mese;
      })
    : rows;

  const dati = perCategoria(righeMese, tipo).map((d) => ({ ...d, totale: Math.abs(d.totale) }));
  const totale = dati.reduce((acc, d) => acc + d.totale, 0);

  const R = 70;
  const spessore = 26;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="graf-blocco">
      <div className="graf-testa">
        <h3>Ripartizione per categoria</h3>
        <div className="graf-controlli">
          <select className="filtro-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="acquisto">Acquisti</option>
            <option value="vendita">Vendite</option>
          </select>
          <select className="filtro-select" value={mese} onChange={(e) => setMese(e.target.value)}>
            <option value="">Tutti i mesi</option>
            {mesi.map((m) => (
              <option key={m} value={m}>{etichettaMese(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {totale === 0 ? (
        <p className="graf-vuoto">Nessun importo per questo tipo nel periodo scelto.</p>
      ) : (
        <div className="torta-wrap">
          <svg viewBox="0 0 180 180" className="torta-svg" role="img" aria-label="Torta categorie">
            <g transform="rotate(-90 90 90)">
              {dati.map((d, i) => {
                const frazione = d.totale / totale;
                const lung = frazione * C;
                const cerchio = (
                  <circle
                    key={d.categoria}
                    cx="90"
                    cy="90"
                    r={R}
                    fill="none"
                    stroke={COLORI[i % COLORI.length]}
                    strokeWidth={spessore}
                    strokeDasharray={`${lung} ${C - lung}`}
                    strokeDashoffset={-offset}
                  >
                    <title>{d.categoria} · {fmt(d.totale)} ({Math.round(frazione * 100)}%)</title>
                  </circle>
                );
                offset += lung;
                return cerchio;
              })}
            </g>
            <text x="90" y="86" textAnchor="middle" className="torta-centro-num">
              {fmtCorto(totale)}
            </text>
            <text x="90" y="102" textAnchor="middle" className="torta-centro-lab">
              totale
            </text>
          </svg>
          <ul className="torta-legenda">
            {dati.map((d, i) => (
              <li key={d.categoria}>
                <i className="pallino" style={{ background: COLORI[i % COLORI.length] }} />
                <span className="torta-cat">{d.categoria}</span>
                <span className="torta-val">
                  {fmt(d.totale)} · {Math.round((d.totale / totale) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- Classifica controparti ----
function TopLista({ titolo, dati, colore }) {
  if (dati.length === 0) return null;
  const max = Math.max(...dati.map((d) => Math.abs(d.totale)), 1);
  return (
    <div className="top-lista">
      <h4>{titolo}</h4>
      <ul>
        {dati.map((d) => (
          <li key={d.controparte}>
            <div className="top-riga-testa">
              <span className="top-nome" title={d.controparte}>{d.controparte}</span>
              <span className="top-val">{fmt(d.totale)}</span>
            </div>
            <div className="top-barra-sfondo">
              <div
                className="top-barra"
                style={{ width: (Math.abs(d.totale) / max) * 100 + '%', background: colore }}
              />
            </div>
            <span className="top-conteggio">
              {d.conteggio} document{d.conteggio === 1 ? 'o' : 'i'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Grafici({ rows, mesi }) {
  const pronte = rows.filter((r) => r.status === 'done');
  if (pronte.length === 0) {
    return (
      <div className="empty">
        <p>Ancora nessun grafico da mostrare.</p>
        <p className="empty-hint">Carica qualche fattura: qui vedrai andamento, categorie e classifiche.</p>
      </div>
    );
  }

  const topFornitori = topControparti(rows, 'acquisto');
  const topClienti = topControparti(rows, 'vendita');

  return (
    <div className="grafici">
      <Andamento rows={rows} />
      <Torta rows={rows} mesi={mesi} />
      <div className="graf-blocco">
        <div className="graf-testa">
          <h3>Chi pesa di più</h3>
        </div>
        <div className="top-griglia">
          <TopLista titolo="Fornitori (acquisti)" dati={topFornitori} colore="var(--accent)" />
          <TopLista titolo="Clienti (vendite)" dati={topClienti} colore="var(--ok)" />
        </div>
      </div>
    </div>
  );
}
