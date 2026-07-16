import React from 'react';
import { parseData, giorniDaOggi, chiaveMese, chiaveTrimestre, etichettaMese } from '../date.js';
import {
  perMese,
  ivaPerTrimestre,
  contaProblemi,
  residuo,
  bolletteMancanti,
} from '../calcoli.js';

const euroFormat = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmt = (v) => euroFormat.format(Number(v) || 0) + ' €';

// La prima scadenza aperta (non pagata, con residuo) in ordine di data.
function prossimaScadenza(rows) {
  const aperte = rows
    .filter((r) => r.status === 'done' && !r.pagato && !r.notaCredito && residuo(r) > 0)
    .map((r) => ({ r, d: parseData(r.scadenza) }))
    .filter((x) => x.d !== null)
    .sort((a, b) => a.d - b.d);
  return aperte[0] || null;
}

function testoGiorni(giorni) {
  if (giorni < 0) return `in ritardo di ${-giorni} ${giorni === -1 ? 'giorno' : 'giorni'}`;
  if (giorni === 0) return 'scade oggi';
  if (giorni === 1) return 'scade domani';
  return `tra ${giorni} giorni`;
}

export default function Dashboard({ rows, onVaiScadenze, onVaiControllare, onVaiRiepilogo }) {
  const pronte = rows.filter((r) => r.status === 'done');
  if (pronte.length === 0) return null;

  const oggi = new Date();
  const meseCorrente = chiaveMese(
    `01/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`
  );
  const gruppi = perMese(rows);
  const gMese = gruppi.get(meseCorrente);
  const saldoMese = gMese ? gMese.vendite - gMese.acquisti : 0;

  const prossima = prossimaScadenza(rows);
  const giorniProssima = prossima ? giorniDaOggi(prossima.d) : null;

  const nProblemi = contaProblemi(rows);

  const trimCorrente = chiaveTrimestre(
    `01/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`
  );
  const ivaTrim = ivaPerTrimestre(rows).find((t) => t.chiave === trimCorrente);

  const mancanti = bolletteMancanti(rows, oggi);

  return (
    <section className="card dashboard">
      <div className="dash-griglia">
        <button className="dash-tile" onClick={onVaiRiepilogo} title="Vai al riepilogo mensile">
          <span className="dash-label">Saldo di {etichettaMese(meseCorrente)}</span>
          <span className={'dash-valore' + (saldoMese < 0 ? ' neg' : ' pos')}>
            {saldoMese >= 0 ? '+' : '−'} {fmt(Math.abs(saldoMese))}
          </span>
          <span className="dash-sub">
            {gMese ? `${gMese.conteggio} document${gMese.conteggio === 1 ? 'o' : 'i'} questo mese` : 'nessun documento questo mese'}
          </span>
        </button>

        <button className="dash-tile" onClick={onVaiScadenze} title="Vai alle scadenze">
          <span className="dash-label">Prossima scadenza</span>
          {prossima ? (
            <>
              <span className={'dash-valore' + (giorniProssima < 0 ? ' neg' : '')}>
                {fmt(residuo(prossima.r))}
              </span>
              <span className="dash-sub">
                {prossima.r.tipo === 'vendita' ? 'da incassare · ' : 'da pagare · '}
                {prossima.r.controparte || prossima.r.fileName} · {testoGiorni(giorniProssima)}
              </span>
            </>
          ) : (
            <>
              <span className="dash-valore pos">—</span>
              <span className="dash-sub">nessun pagamento in sospeso</span>
            </>
          )}
        </button>

        <button
          className={'dash-tile' + (nProblemi > 0 ? ' warn' : '')}
          onClick={onVaiControllare}
          title="Mostra i documenti con un avviso"
        >
          <span className="dash-label">Da controllare</span>
          <span className="dash-valore">{nProblemi}</span>
          <span className="dash-sub">
            {nProblemi === 0 ? 'tutto in ordine' : nProblemi === 1 ? 'documento con un avviso' : 'documenti con un avviso'}
          </span>
        </button>

        <button className="dash-tile" onClick={onVaiRiepilogo} title="Vai al riepilogo (stima IVA)">
          <span className="dash-label">
            Stima IVA {trimCorrente ? trimCorrente.replace('-T', ' · T') : ''}
          </span>
          {ivaTrim ? (
            <>
              <span className={'dash-valore' + (ivaTrim.saldo >= 0 ? '' : ' pos')}>
                {fmt(Math.abs(ivaTrim.saldo))}
              </span>
              <span className="dash-sub">{ivaTrim.saldo >= 0 ? 'da versare (stima)' : 'a credito (stima)'}</span>
            </>
          ) : (
            <>
              <span className="dash-valore">—</span>
              <span className="dash-sub">nessun dato nel trimestre</span>
            </>
          )}
        </button>
      </div>

      {mancanti.length > 0 && (
        <div className="dash-avviso">
          ⏳ Forse manca una bolletta di questo mese:{' '}
          {mancanti.map((m, i) => (
            <span key={m.controparte}>
              {i > 0 && ', '}
              <strong>{m.controparte}</strong>
              {' '}(ultima: {etichettaMese(m.ultimoMese)})
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
