import React, { useEffect, useRef, useState } from 'react';
import DropZone from './components/DropZone.jsx';
import DataTable from './components/DataTable.jsx';
import ApiKeyModal from './components/ApiKeyModal.jsx';
import Riepilogo from './components/Riepilogo.jsx';
import { extractDocument, errorMessage, getApiKey } from './gemini.js';
import { exportCsv } from './csv.js';
import { salvaDocumento, leggiDocumento, eliminaDocumento, svuotaDocumenti } from './db.js';
import { ricordaControparte, applicaMemoria } from './memoria.js';

const ROWS_STORAGE = 'estrattore.rows';

function loadRows() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROWS_STORAGE) || '[]');
    // Le righe rimaste a metà da una sessione precedente diventano errori
    // (si possono riprovare: il file è nell'archivio del dispositivo); le
    // righe salvate da versioni precedenti dell'app ricevono i campi nuovi.
    return saved.map((r) => ({
      tipo: 'acquisto',
      categoria: 'Altro',
      ...r,
      controparte: r.controparte ?? r.fornitore ?? '',
      ...(r.status === 'queued' || r.status === 'processing'
        ? { status: 'error', error: 'Elaborazione interrotta: premi Riprova.' }
        : {}),
    }));
  } catch {
    return [];
  }
}

export default function App() {
  const [rows, setRows] = useState(loadRows);
  const [view, setView] = useState('documenti');
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const filesRef = useRef(new Map()); // id riga → File, per l'elaborazione in corso
  const queueRef = useRef(Promise.resolve()); // coda sequenziale, evita i limiti di frequenza

  useEffect(() => {
    localStorage.setItem(ROWS_STORAGE, JSON.stringify(rows));
  }, [rows]);

  function mostraAvviso(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  function patch(id, changes) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }

  async function processRow(id) {
    let file = filesRef.current.get(id);
    if (!file) {
      // Dopo un riavvio il file non è più in memoria: recuperalo dall'archivio.
      try {
        const rec = await leggiDocumento(id);
        if (rec) {
          file = rec.blob;
          filesRef.current.set(id, file);
        }
      } catch {
        /* archivio non disponibile: gestito sotto */
      }
    }
    if (!file) {
      patch(id, { status: 'error', error: 'File non disponibile su questo dispositivo: ricaricalo.' });
      return;
    }
    patch(id, { status: 'processing', error: '' });
    try {
      const fields = applicaMemoria(await extractDocument(file));
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
      salvaDocumento(id, file).catch(() => {});
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

  function handleEdit(id, changes) {
    patch(id, changes);
    // Le correzioni manuali su controparte/categoria/P.IVA vanno ricordate
    // per i prossimi documenti della stessa controparte.
    if ('categoria' in changes || 'controparte' in changes || 'partita_iva' in changes) {
      const row = rows.find((r) => r.id === id);
      if (row) ricordaControparte({ ...row, ...changes });
    }
  }

  function handleRetry(id) {
    enqueue(id);
  }

  function handleDelete(id) {
    filesRef.current.delete(id);
    eliminaDocumento(id).catch(() => {});
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function handleClear() {
    if (window.confirm('Vuoi davvero svuotare la tabella? I dati non esportati e i file archiviati andranno persi.')) {
      filesRef.current.clear();
      svuotaDocumenti().catch(() => {});
      setRows([]);
    }
  }

  async function handleOpenFile(id) {
    try {
      const rec = await leggiDocumento(id);
      if (!rec) {
        mostraAvviso('Il documento originale non è archiviato su questo dispositivo.');
        return;
      }
      const url = URL.createObjectURL(rec.blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      mostraAvviso('Impossibile aprire il documento.');
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
          <div className="tabs">
            <button
              className={'tab' + (view === 'documenti' ? ' active' : '')}
              onClick={() => setView('documenti')}
            >
              Documenti
            </button>
            <button
              className={'tab' + (view === 'riepilogo' ? ' active' : '')}
              onClick={() => setView('riepilogo')}
            >
              Riepilogo mensile
            </button>
            {view === 'riepilogo' && (
              <button className="btn btn-ghost tabs-print" onClick={() => window.print()}>
                🖨 Stampa
              </button>
            )}
          </div>

          {view === 'documenti' ? (
            <>
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
                onEdit={handleEdit}
                onRetry={handleRetry}
                onDelete={handleDelete}
                onOpenFile={handleOpenFile}
              />
            </>
          ) : (
            <Riepilogo rows={rows} />
          )}
        </section>
      </main>

      <footer className="footer">
        I dati restano su questo dispositivo · Estrazione con Google Gemini
      </footer>

      {showSettings && <ApiKeyModal onClose={() => setShowSettings(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
