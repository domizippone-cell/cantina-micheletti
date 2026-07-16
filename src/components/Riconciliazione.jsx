import React, { useRef, useState } from 'react';
import { parseEstrattoConto, abbinaMovimenti } from '../riconciliazione.js';
import { residuo } from '../calcoli.js';

const euroFormat = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmt = (v) => euroFormat.format(Number(v) || 0) + ' €';

function dataCorta(d) {
  return d ? d.toLocaleDateString('it-IT') : '—';
}

export default function Riconciliazione({ rows, onEdit, onClose }) {
  const [fase, setFase] = useState('scelta'); // scelta | anteprima | fatto
  const [abbinati, setAbbinati] = useState([]);
  const [nonAbbinati, setNonAbbinati] = useState([]);
  const [selezione, setSelezione] = useState(() => new Set());
  const [avviso, setAvviso] = useState('');
  const [esito, setEsito] = useState('');
  const inputRef = useRef(null);

  async function onFile(file) {
    if (!file) return;
    setAvviso('Lettura dell\'estratto conto…');
    try {
      const testo = await file.text();
      const { movimenti, avviso: av } = parseEstrattoConto(testo);
      if (av) { setAvviso(av); return; }
      const { abbinati: ab, nonAbbinati: na } = abbinaMovimenti(movimenti, rows);
      setAbbinati(ab);
      setNonAbbinati(na);
      setSelezione(new Set(ab.map((x) => x.riga.id)));
      setAvviso('');
      setFase('anteprima');
    } catch {
      setAvviso('Non sono riuscito a leggere il file.');
    }
  }

  function toggle(id) {
    setSelezione((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function conferma() {
    let n = 0;
    for (const { riga } of abbinati) {
      if (!selezione.has(riga.id)) continue;
      onEdit(riga.id, { pagato: true, metodo: riga.metodo || 'Bonifico' });
      n += 1;
    }
    const verbo = n === 1 ? 'documento segnato' : 'documenti segnati';
    setEsito(
      n === 0
        ? 'Nessun abbinamento selezionato: non ho cambiato nulla.'
        : `${n} ${verbo} come pagato/incassato in base all'estratto conto.`
    );
    setFase('fatto');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-largo" onClick={(e) => e.stopPropagation()}>
        <h2>Riconciliazione estratto conto</h2>

        {fase === 'scelta' && (
          <>
            <p className="modal-text">
              Importa il file CSV dell'estratto conto della banca: cerco i movimenti che combaciano
              con le fatture ancora aperte e ti propongo di segnarle come pagate o incassate.
              Nessun dato bancario viene inviato online: resta tutto su questo dispositivo.
            </p>
            <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
              ⬆ Scegli il file (.csv)
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={(e) => { onFile(e.target.files[0]); e.target.value = ''; }}
            />
            {avviso && <p className="backup-stato">{avviso}</p>}
          </>
        )}

        {fase === 'anteprima' && (
          <>
            <p className="modal-text">
              Trovati <strong>{abbinati.length}</strong> abbinamenti su{' '}
              {abbinati.length + nonAbbinati.length} movimenti utili. Deseleziona quelli che non
              vuoi confermare.
            </p>
            <div className="ric-lista">
              {abbinati.length === 0 && (
                <p className="backup-stato">
                  Nessun movimento combacia con le fatture aperte (per importo).
                </p>
              )}
              {abbinati.map(({ mov, riga }) => (
                <label className="ric-voce" key={riga.id}>
                  <input
                    type="checkbox"
                    checked={selezione.has(riga.id)}
                    onChange={() => toggle(riga.id)}
                  />
                  <span className="ric-mov">
                    <strong>{fmt(Math.abs(mov.importo))}</strong>
                    <span className="ric-sub">
                      {dataCorta(mov.data)} · {mov.descrizione || 'movimento'}
                    </span>
                  </span>
                  <span className="ric-freccia">→</span>
                  <span className="ric-doc">
                    <strong>{riga.controparte || riga.fileName}</strong>
                    <span className="ric-sub">
                      {riga.tipo === 'vendita' ? 'da incassare' : 'da pagare'} · residuo {fmt(residuo(riga))}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {nonAbbinati.length > 0 && (
              <p className="modal-hint">
                {nonAbbinati.length} movimenti non abbinati (nessuna fattura aperta con lo stesso
                importo): probabilmente spese senza fattura, giroconti o pagamenti già segnati.
              </p>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFase('scelta')}>Indietro</button>
              <button className="btn btn-primary" onClick={conferma} disabled={selezione.size === 0}>
                Conferma {selezione.size > 0 ? `(${selezione.size})` : ''}
              </button>
            </div>
          </>
        )}

        {fase === 'fatto' && (
          <>
            <p className="backup-stato">{esito}</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onClose}>Chiudi</button>
            </div>
          </>
        )}

        {fase === 'scelta' && (
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>Chiudi</button>
          </div>
        )}
      </div>
    </div>
  );
}
