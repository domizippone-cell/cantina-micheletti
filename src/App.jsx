import React, { useEffect, useRef, useState } from 'react';
import DropZone from './components/DropZone.jsx';
import DataTable from './components/DataTable.jsx';
import ApiKeyModal from './components/ApiKeyModal.jsx';
import { extractDocument, errorMessage, getApiKey } from './gemini.js';
import { exportCsv } from './csv.js';

const ROWS_STORAGE = 'estrattore.rows';

function loadRows() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROWS_STORAGE) || '[]');
    // Le righe rimaste a metà da una sessione precedente diventano errori
    // (il file non è più disponibile per riprovare in automatico); le righe
    // salvate da versioni precedenti dell'app ricevono i campi nuovi.
    return saved.map((r) => ({
      tipo: 'acquisto',
      categoria: 'Altro',
      ...r,
      controparte: r.controparte ?? r.fornitore ?? '',
      ...(r.status === 'queued' || r.status === 'processing'
        ? { status: 'error', error: 'Elaborazione interrotta: ricarica il file.' }
        : {}),
    }));
  } catch {
    return [];
  }
}

export default function App() {
  const [rows, setRows] = useState(loadRows);
  const [showSettings, setShowSettings] = useState(false);
  const filesRef = useRef(new Map()); // id riga → File, per elaborazione e "Riprova"
  const queueRef = useRef(Promise.resolve()); // coda sequenziale, evita i limiti di frequenza

  useEffect(() => {
    localStorage.setItem(ROWS_STORAGE, JSON.stringify(rows));
  }, [rows]);

  function patch(id, changes) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }

  async function processRow(id) {
    const file = filesRef.current.get(id);
    if (!file) return;
    patch(id, { status: 'processing', error: '' });
    try {
      const fields = await extractDocument(file);
      patch(id, { ...fields, status: 'done' });
    } catch (err) {
      patch(id, { status: 'error', error: errorMessage(err) });
    }
  }

  function enqueue(id) {
    queueRef.current = queueRef.current.then(() => processRow(id));
  }

  function handleFiles(files) {
    if (!getApiKey()) {
      setShowSettings(true);
      return;
    }
    const newRows = files.map((file) => {
      const id = crypto.randomUUID();
      filesRef.current.set(id, file);
      return {
        id,
        fileName: file.name,
        status: 'queued',
        tipo: 'acquisto',
        controparte: '',
        data: '',
        partita_iva: '',
        imponibile: 0,
        iva: 0,
        totale: 0,
        categoria: 'Altro',
        error: '',
      };
    });
    setRows((rs) => [...rs, ...newRows]);
    newRows.forEach((r) => enqueue(r.id));
  }

  function handleRetry(id) {
    if (filesRef.current.has(id)) enqueue(id);
  }

  function handleDelete(id) {
    filesRef.current.delete(id);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function handleClear() {
    if (window.confirm('Vuoi davvero svuotare la tabella? I dati non esportati andranno persi.')) {
      filesRef.current.clear();
      setRows([]);
    }
  }

  const busy = rows.some((r) => r.status === 'queued' || r.status === 'processing');

  const euroFormat = new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const totalePer = (tipo) =>
    euroFormat.format(
      rows.filter((r) => r.tipo === tipo).reduce((acc, r) => acc + (Number(r.totale) || 0), 0)
    ) + ' €';

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="logo">🍷</div>
          <div>
            <h1>Cantina Micheletti</h1>
            <p>Fatture di acquisto e vendita → tabella pronta per Excel</p>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setShowSettings(true)}
          title="Impostazioni chiave API"
          aria-label="Impostazioni"
        >
          ⚙️
        </button>
      </header>

      <main className="main">
        <DropZone onFiles={handleFiles} />

        <section className="card table-card">
          <div className="toolbar">
            <div className="toolbar-info">
              <strong>{rows.length}</strong> {rows.length === 1 ? 'documento' : 'documenti'}
              {rows.length > 0 && (
                <span className="stats">
                  {' · '}
                  <span className="stat stat-vendite">Vendite {totalePer('vendita')}</span>
                  {' · '}
                  <span className="stat stat-acquisti">Acquisti {totalePer('acquisto')}</span>
                </span>
              )}
              {busy && <span className="working"> · elaborazione in corso…</span>}
            </div>
            <div className="toolbar-actions">
              <button className="btn btn-ghost" onClick={handleClear} disabled={rows.length === 0}>
                Svuota
              </button>
              <button
                className="btn btn-primary"
                onClick={() => exportCsv(rows)}
                disabled={rows.length === 0}
              >
                ⬇ Esporta Excel
              </button>
            </div>
          </div>
          <DataTable
            rows={rows}
            onEdit={patch}
            onRetry={handleRetry}
            onDelete={handleDelete}
            canRetry={(id) => filesRef.current.has(id)}
          />
        </section>
      </main>

      <footer className="footer">
        I dati restano su questo dispositivo · Estrazione con Google Gemini
      </footer>

      {showSettings && <ApiKeyModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
