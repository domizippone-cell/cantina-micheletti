import React, { useRef, useState } from 'react';
import { getApiKey, setApiKey } from '../gemini.js';
import { esportaBackup, importaBackup } from '../backup.js';

export default function ApiKeyModal({ onClose, rows, onImportaRighe }) {
  const [key, setKey] = useState(getApiKey());
  const [show, setShow] = useState(false);
  const [statoBackup, setStatoBackup] = useState('');
  const importRef = useRef(null);

  function save() {
    setApiKey(key);
    onClose();
  }

  async function handleEsporta() {
    setStatoBackup('Preparazione del backup…');
    try {
      await esportaBackup(rows);
      setStatoBackup('Backup scaricato: portalo sull\'altro dispositivo e importalo da qui.');
    } catch {
      setStatoBackup('Non sono riuscito a preparare il backup.');
    }
  }

  async function handleImporta(file) {
    if (!file) return;
    setStatoBackup('Importazione in corso…');
    try {
      const esito = await importaBackup(file, rows);
      onImportaRighe(esito.righe);
      const aggiunte =
        esito.aggiunte === 1
          ? 'Importato 1 documento nuovo'
          : `Importati ${esito.aggiunte} documenti nuovi`;
      const giaPresenti =
        esito.giaPresenti === 1
          ? " (1 era già qui ed è rimasto com'era)"
          : ` (${esito.giaPresenti} erano già qui e sono rimasti com'erano)`;
      setStatoBackup(
        esito.aggiunte === 0
          ? 'Nessun documento nuovo: erano già tutti su questo dispositivo.'
          : aggiunte + (esito.giaPresenti > 0 ? giaPresenti : '') + '.'
      );
    } catch {
      setStatoBackup('Questo file non sembra un backup dell\'app: controlla di aver scelto quello giusto.');
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
                handleImporta(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </div>
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
