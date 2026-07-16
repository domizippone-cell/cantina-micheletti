import React from 'react';
import { etichettaMese, etichettaTrimestre } from '../date.js';
import { perMese, ivaPerTrimestre } from '../calcoli.js';

const euroFormat = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmt = (v) => euroFormat.format(Number(v) || 0) + ' €';

function etichetta(chiave) {
  return chiave === 'senza-data' ? 'Senza data' : etichettaMese(chiave);
}

// "2026-07" → "2025-07": stessa mensilità dell'anno precedente.
function meseAnnoPrima(chiave) {
  if (chiave === 'senza-data') return null;
  const [anno, mese] = chiave.split('-');
  return Number(anno) - 1 + '-' + mese;
}

// Variazione percentuale leggibile rispetto a un valore precedente.
function variazione(attuale, precedente) {
  if (!precedente) return null;
  const perc = Math.round(((attuale - precedente) / Math.abs(precedente)) * 100);
  return perc;
}

function IvaTrimestrale({ rows }) {
  const trimestri = ivaPerTrimestre(rows).slice(0, 4);
  if (trimestri.length === 0) return null;

  return (
    <div className="iva-box">
      <div className="iva-testa">
        <h3>Stima IVA per trimestre</h3>
        <span className="iva-nota">
          IVA sulle vendite − IVA sugli acquisti. È una stima da confrontare col commercialista.
        </span>
      </div>
      <div className="iva-cards">
        {trimestri.map((t) => {
          const daVersare = t.saldo >= 0;
          return (
            <div className="iva-card" key={t.chiave}>
              <div className="iva-card-titolo">{etichettaTrimestre(t.chiave)}</div>
              <div className="iva-card-riga">
                <span>IVA vendite (a debito)</span>
                <span>{fmt(t.ivaVendite)}</span>
              </div>
              <div className="iva-card-riga">
                <span>IVA acquisti (a credito)</span>
                <span>{fmt(t.ivaAcquisti)}</span>
              </div>
              <div className={'iva-card-saldo' + (daVersare ? '' : ' credito')}>
                <span>{daVersare ? 'Da versare' : 'Credito IVA'}</span>
                <span>{fmt(Math.abs(t.saldo))}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Riepilogo({ rows }) {
  const gruppi = perMese(rows);

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
      <IvaTrimestrale rows={rows} />
      {chiavi.map((k) => {
        const g = gruppi.get(k);
        const saldo = g.vendite - g.acquisti;
        const kPrima = meseAnnoPrima(k);
        const gPrima = kPrima ? gruppi.get(kPrima) : null;
        const varVendite = gPrima ? variazione(g.vendite, gPrima.vendite) : null;
        const varAcquisti = gPrima ? variazione(g.acquisti, gPrima.acquisti) : null;
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
            {gPrima && (varVendite !== null || varAcquisti !== null) && (
              <div className="mese-confronto">
                vs {etichetta(kPrima)}:{' '}
                {varVendite !== null && (
                  <span className={varVendite >= 0 ? 'su' : 'giu'}>
                    vendite {varVendite >= 0 ? '+' : ''}
                    {varVendite}%
                  </span>
                )}
                {varVendite !== null && varAcquisti !== null && ' · '}
                {varAcquisti !== null && (
                  <span className={varAcquisti <= 0 ? 'su' : 'giu'}>
                    acquisti {varAcquisti >= 0 ? '+' : ''}
                    {varAcquisti}%
                  </span>
                )}
              </div>
            )}
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
