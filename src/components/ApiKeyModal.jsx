import React, { useState } from 'react';
import { getApiKey, setApiKey } from '../gemini.js';

export default function ApiKeyModal({ onClose }) {
  const [key, setKey] = useState(getApiKey());
  const [show, setShow] = useState(false);

  function save() {
    setApiKey(key);
    onClose();
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
