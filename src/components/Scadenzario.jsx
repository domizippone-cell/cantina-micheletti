import React, { useState } from 'react';
import { parseData, giorniDaOggi } from '../date.js';
import { residuo, parseImporto } from '../calcoli.js';

const euroFormat = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmt = (v) => euroFormat.format(Number(v) || 0) + ' €';

// Quante righe non pagate sono già scadute o scadono entro una settimana:
// è il numero che accende il pallino rosso sulla scheda "Scadenze". Le note
// di credito non sono un pagamento dovuto e restano fuori.
export function scadenzeUrgenti(rows) {
  return rows.filter((r) => {
    if (r.status !== 'done' || r.pagato || r.notaCredito || residuo(r) <= 0) return false;
    const d = parseData(r.scadenza);
    return d !== null && giorniDaOggi(d) <= 7;
  }).length;
}

function StatoBadge({ scadenza }) {
  const d = parseData(scadenza);
  if (!d) return null;
  const giorni = giorniDaOggi(d);
  if (giorni < 0) {
    return (
      <span className="scad-badge scad-ritardo">
        in ritardo di {-giorni} {giorni === -1 ? 'giorno' : 'giorni'}
      </span>
    );
  }
  if (giorni === 0) return <span className="scad-badge scad-presto">scade oggi</span>;
  if (giorni === 1) return <span className="scad-badge scad-presto">scade domani</span>;
  if (giorni <= 7) return <span className="scad-badge scad-presto">scade tra {giorni} giorni</span>;
  return <span className="scad-badge">tra {giorni} giorni</span>;
}

// Editor compatto dell'acconto già versato per una fattura non ancora saldata.
function AccontoEditor({ row, onEdit }) {
  const [draft, setDraft] = useState('');
  const [aperto, setAperto] = useState(false);
  const acconto = Number(row.acconto) || 0;
  const totale = Number(row.totale) || 0;

  function commit() {
    const val = Math.min(Math.max(0, parseImporto(draft)), totale);
    // Se copre (o supera) il totale, il documento è saldato del tutto.
    if (val >= totale && totale > 0) onEdit(row.id, { acconto: totale, pagato: true });
    else onEdit(row.id, { acconto: val });
    setAperto(false);
  }

  if (!aperto) {
    return (
      <button
        className="scad-acconto-link"
        onClick={() => {
          setDraft(acconto ? acconto.toFixed(2).replace('.', ',') : '');
          setAperto(true);
        }}
      >
        {acconto > 0 ? '✎ acconto' : '＋ acconto'}
      </button>
    );
  }

  return (
    <span className="scad-acconto-edit">
      <input
        className="cell-input scad-acconto-input"
        autoFocus
        inputMode="decimal"
        placeholder="0,00"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setAperto(false);
        }}
      />
      <button className="btn btn-primary btn-sm" onClick={commit}>OK</button>
    </span>
  );
}

function Voce({ row, onEdit, onOpenFile, pagata }) {
  const verbo = row.tipo === 'vendita' ? 'Incassata' : 'Pagata';
  const acconto = Number(row.acconto) || 0;
  const totale = Number(row.totale) || 0;
  const res = residuo(row);
  const parziale = !pagata && acconto > 0 && res > 0;

  return (
    <li className={'scad-voce' + (pagata ? ' scad-fatta' : '')}>
      <div className="scad-info">
        <button
          className="file-name"
          title={'Apri il documento originale: ' + row.fileName}
          onClick={() => onOpenFile(row.id)}
        >
          {row.controparte || row.fileName}
        </button>
        <div className="scad-dettagli">
          {parseData(row.scadenza) ? (
            <span className="scad-data">scadenza {row.scadenza}</span>
          ) : (
            <span className="scad-data">documento del {row.data || '—'}</span>
          )}
          {!pagata && <StatoBadge scadenza={row.scadenza} />}
          {parziale && (
            <span className="scad-badge scad-parziale">
              acconto {fmt(acconto)} di {fmt(totale)}
            </span>
          )}
        </div>
      </div>
      <span className="scad-importo">
        {parziale ? (
          <>
            {fmt(res)} <span className="scad-importo-nota">residuo</span>
          </>
        ) : (
          fmt(totale)
        )}
      </span>
      {pagata ? (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onEdit(row.id, { pagato: false })}
          title="Riporta tra quelle da pagare"
        >
          ↩ Annulla
        </button>
      ) : (
        <span className="scad-azioni">
          <AccontoEditor row={row} onEdit={onEdit} />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onEdit(row.id, { pagato: true })}
            title={'Segna come ' + verbo.toLowerCase()}
          >
            ✓ {verbo}
          </button>
        </span>
      )}
    </li>
  );
}

function Gruppo({ titolo, voci, onEdit, onOpenFile }) {
  if (voci.length === 0) return null;
  const totale = voci.reduce((acc, r) => acc + residuo(r), 0);
  return (
    <div className="scad-gruppo">
      <div className="scad-testa">
        <h3>{titolo}</h3>
        <span className="scad-totale">
          {voci.length} {voci.length === 1 ? 'documento' : 'documenti'} · {fmt(totale)}
        </span>
      </div>
      <ul className="scad-lista">
        {voci.map((r) => (
          <Voce key={r.id} row={r} onEdit={onEdit} onOpenFile={onOpenFile} />
        ))}
      </ul>
    </div>
  );
}

export default function Scadenzario({ rows, onEdit, onOpenFile }) {
  const [mostraPagate, setMostraPagate] = useState(false);

  const pronte = rows.filter((r) => r.status === 'done' && !r.notaCredito);
  const aperte = pronte.filter((r) => !r.pagato && residuo(r) > 0);
  const pagate = pronte.filter((r) => r.pagato || residuo(r) <= 0);

  const perScadenza = (a, b) => parseData(a.scadenza) - parseData(b.scadenza);
  const daPagare = aperte
    .filter((r) => r.tipo === 'acquisto' && parseData(r.scadenza))
    .sort(perScadenza);
  const daIncassare = aperte
    .filter((r) => r.tipo === 'vendita' && parseData(r.scadenza))
    .sort(perScadenza);
  const senzaScadenza = aperte.filter((r) => !parseData(r.scadenza));

  if (pronte.length === 0) {
    return (
      <div className="empty">
        <p>Nessuna scadenza da mostrare.</p>
        <p className="empty-hint">
          Carica qualche fattura: qui troverai cosa c'è da pagare e da incassare, in ordine di
          scadenza.
        </p>
      </div>
    );
  }

  return (
    <div className="scadenzario">
      {aperte.length === 0 && (
        <div className="empty">
          <p>Tutto in regola: nessun pagamento in sospeso. 🎉</p>
        </div>
      )}
      <Gruppo titolo="💶 Da incassare" voci={daIncassare} onEdit={onEdit} onOpenFile={onOpenFile} />
      <Gruppo titolo="📤 Da pagare" voci={daPagare} onEdit={onEdit} onOpenFile={onOpenFile} />
      {senzaScadenza.length > 0 && (
        <div className="scad-gruppo">
          <div className="scad-testa">
            <h3>Senza data di scadenza</h3>
            <span className="scad-totale">
              {senzaScadenza.length} {senzaScadenza.length === 1 ? 'documento' : 'documenti'}
            </span>
          </div>
          <p className="scad-hint">
            Per vederle in ordine di scadenza, aggiungi la data nella colonna «Scadenza» della
            tabella Documenti.
          </p>
          <ul className="scad-lista">
            {senzaScadenza.map((r) => (
              <Voce key={r.id} row={r} onEdit={onEdit} onOpenFile={onOpenFile} />
            ))}
          </ul>
        </div>
      )}
      {pagate.length > 0 && (
        <div className="scad-gruppo">
          <button className="scad-toggle" onClick={() => setMostraPagate(!mostraPagate)}>
            {mostraPagate ? 'Nascondi le già pagate' : `Mostra le già pagate (${pagate.length})`}
          </button>
          {mostraPagate && (
            <ul className="scad-lista">
              {pagate.map((r) => (
                <Voce key={r.id} row={r} onEdit={onEdit} onOpenFile={onOpenFile} pagata />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
