import React, { useRef, useState } from 'react';
import { getApiKey, setApiKey } from '../gemini.js';
import { esportaBackup, leggiBackup, aggiungiDaBackup, sostituisciConBackup } from '../backup.js';

export default function ApiKeyModal({ onClose, rows, onAggiungiRighe, onSostituisciRighe }) {
  const [key, setKey] = useState(getApiKey());
  const [show, setShow] = useState(false);
  const [statoBackup, setStatoBackup] = useState('');
  const [inAttesa, setInAttesa] = useState(null); // backup letto, in attesa della scelta
  const importRef = useRef(null);

  function save() {
    setApiKey(key);
    onClose();
  }

  async function handleEsporta() {
    setInAttesa(null);
    setStatoBackup('Preparazione del backup…');
    try {
      await esportaBackup(rows);
      setStatoBackup('Backup scaricato: portalo sull\'altro dispositivo e importalo da qui.');
    } catch {
      setStatoBackup('Non sono riuscito a preparare il backup.');
    }
  }

  // Passo 1: leggi il file e chiedi come importarlo.
  async function handleFileScelto(file) {
    if (!file) return;
    setStatoBackup('Lettura del backup…');
    try {
      const backup = await leggiBackup(file);
      setInAttesa(backup);
      setStatoBackup('');
    } catch {
      setInAttesa(null);
      setStatoBackup('Questo file non sembra un backup dell\'app: controlla di aver scelto quello giusto.');
    }
  }

  // Passo 2: applica il backup nel modo scelto.
  async function applica(modo) {
    const backup = inAttesa;
    setInAttesa(null);
    setStatoBackup('Importazione in corso…');
    try {
      if (modo === 'sostituisci') {
        const esito = await sostituisciConBackup(backup);
        onSostituisciRighe(esito.righe);
        setStatoBackup(
          `Fatto: questo dispositivo ora ha esattamente i ${esito.aggiunte} documenti del backup.`
        );
      } else {
        const esito = await aggiungiDaBackup(backup, rows);
        onAggiungiRighe(esito.righe);
        const aggiunte =
          esito.aggiunte === 1 ? 'Aggiunto 1 documento nuovo' : `Aggiunti ${esito.aggiunte} documenti nuovi`;
        const gia =
          esito.giaPresenti === 1
            ? " (1 era già qui ed è stato lasciato com'era)"
            : ` (${esito.giaPresenti} erano già qui e sono stati lasciati com'erano)`;
        setStatoBackup(
          esito.aggiunte === 0
            ? 'Nessun documento nuovo: erano già tutti su questo dispositivo.'
            : aggiunte + (esito.giaPresenti > 0 ? gia : '') + '.'
        );
      }
    } catch {
      setStatoBackup('Qualcosa è andato storto durante l\'importazione.');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Chiave API di Gemini</h2>
        <p className="modal-text">
          Serve una chiave API di Google Gemini per leggere i documenti. Va inserita una volta
          sola: resta salvata soltanto su questo dispositivo, mai nel codice dell'app.
        </p>
        <div className="key-row">
          <input
            className="key-input"
            type={show ? 'text' : 'password'}
            value={key}
            placeholder="Incolla qui la chiave…"
            autoFocus
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
          />
          <button className="btn btn-ghost" onClick={() => setShow(!show)}>
            {show ? 'Nascondi' : 'Mostra'}
          </button>
        </div>
        <p className="modal-hint">
          Non hai una chiave? Creala gratis su{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>
          .
        </p>

        <div className="modal-sezione">
          <h3>Backup e trasferimento</h3>
          <p className="modal-text">
            I dati vivono solo su questo dispositivo. Per portarli su un altro (o tenerne una
            copia), esporta il backup qui e importalo dall'altra parte: contiene tabella,
            documenti originali e memoria fornitori.
          </p>
          <div className="backup-row">
            <button className="btn btn-ghost" onClick={handleEsporta}>
              ⬇ Esporta backup
            </button>
            <button className="btn btn-ghost" onClick={() => importRef.current?.click()}>
              ⬆ Importa backup
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                handleFileScelto(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </div>

          {inAttesa && (
            <div className="backup-scelta">
              <p>
                Backup di <strong>{inAttesa.righe.length}</strong>{' '}
                {inAttesa.righe.length === 1 ? 'documento' : 'documenti'}
                {inAttesa.esportato && ' del ' + new Date(inAttesa.esportato).toLocaleDateString('it-IT')}.
                Come vuoi importarlo?
              </p>
              <div className="backup-scelta-azioni">
                <button className="btn btn-primary" onClick={() => applica('sostituisci')}>
                  Sostituisci tutto
                </button>
                <button className="btn btn-ghost" onClick={() => applica('aggiungi')}>
                  Aggiungi ai dati attuali
                </button>
                <button className="btn btn-ghost" onClick={() => setInAttesa(null)}>
                  Annulla
                </button>
              </div>
              <p className="backup-scelta-nota">
                <strong>Sostituisci tutto</strong>: questo dispositivo diventa una copia esatta del
                backup (cancella ciò che c'è ora). <strong>Aggiungi</strong>: tiene i documenti
                attuali e unisce solo quelli nuovi.
              </p>
            </div>
          )}

          {statoBackup && <p className="backup-stato">{statoBackup}</p>}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Annulla
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!key.trim()}>
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
