import React, { useEffect, useRef, useState } from 'react';
import DropZone from './components/DropZone.jsx';
import Dashboard from './components/Dashboard.jsx';
import DataTable from './components/DataTable.jsx';
import Grafici from './components/Grafici.jsx';
import Riconciliazione from './components/Riconciliazione.jsx';
import ApiKeyModal from './components/ApiKeyModal.jsx';
import Riepilogo from './components/Riepilogo.jsx';
import Scadenzario, { scadenzeUrgenti } from './components/Scadenzario.jsx';
import Filtri, { FILTRI_VUOTI, filtraRighe, filtriAttivi } from './components/Filtri.jsx';
import { contaProblemi, netto } from './calcoli.js';
import { aggiornaPromemoria } from './notifiche.js';
import { extractDocument, errorMessage, getApiKey } from './gemini.js';
import { exportCsv } from './csv.js';
import { salvaDocumento, leggiDocumento, eliminaDocumento, svuotaDocumenti } from './db.js';
import { ricordaControparte, applicaMemoria } from './memoria.js';
import { chiaveMese } from './date.js';
import {
  syncConfigurato,
  syncAttiva,
  getSyncCode,
  setSyncCode,
  generaSyncCode,
  avviaSync,
  salvaRiga,
  eliminaRiga,
  caricaFile,
  ottieniFile,
  leggiTutteRemote,
  spingiLocaliNelCloud,
} from './sync.js';

const ROWS_STORAGE = 'estrattore.rows';

// Riempie i campi mancanti di una riga con i valori di default.
function conDefault(r) {
  return {
    tipo: 'acquisto',
    categoria: 'Altro',
    scadenza: '',
    pagato: false,
    acconto: 0,
    metodo: '',
    nota: '',
    notaCredito: false,
    error: '',
    ...r,
    controparte: r.controparte ?? r.fornitore ?? '',
  };
}

// Come conDefault, ma tratta le righe rimaste "a metà" da una sessione locale
// precedente come errori riprovabili. Da usare SOLO sui dati locali: sui dati
// remoti lo stato "in elaborazione" può appartenere a un altro dispositivo.
function sanificaRiga(r) {
  const base = conDefault(r);
  if (r.status === 'queued' || r.status === 'processing') {
    return { ...base, status: 'error', error: 'Elaborazione interrotta: premi Riprova.' };
  }
  return base;
}

function loadRows() {
  try {
    return JSON.parse(localStorage.getItem(ROWS_STORAGE) || '[]').map(sanificaRiga);
  } catch {
    return [];
  }
}

export default function App() {
  // In modalità sincronizzata i dati arrivano da Firestore; in locale da
  // localStorage. syncOn è deciso all'avvio: attivare/disattivare ricarica.
  const [syncOn] = useState(syncAttiva);
  const [rows, setRows] = useState(() => (syncOn ? [] : loadRows()));
  const [view, setView] = useState('documenti');
  const [filtri, setFiltri] = useState(FILTRI_VUOTI);
  const [showSettings, setShowSettings] = useState(false);
  const [showRiconcilia, setShowRiconcilia] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const filesRef = useRef(new Map()); // id riga → File, per l'elaborazione in corso
  const queueRef = useRef(Promise.resolve()); // coda sequenziale, evita i limiti di frequenza
  const rowsRef = useRef(rows); // sempre l'ultimo valore, per le scritture remote

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Promemoria scadenze: a ogni cambiamento aggiorna l'elenco per il service
  // worker e, se serve, mostra l'avviso. Non fa nulla se le notifiche sono spente.
  useEffect(() => {
    aggiornaPromemoria(rows);
  }, [rows]);

  // File arrivati da "Condividi" di un'altra app (WhatsApp, Gmail, Foto): il
  // service worker li ha messi da parte, qui li raccogliamo e li mettiamo in coda.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('condivisi') !== '1') return;
    if (!('caches' in window)) return;
    (async () => {
      try {
        const cache = await caches.open('condivisi');
        const chiavi = await cache.keys();
        const files = [];
        for (const req of chiavi) {
          const res = await cache.match(req);
          if (!res) continue;
          const blob = await res.blob();
          const nome = decodeURIComponent(res.headers.get('x-nome-file') || 'condiviso');
          files.push(new File([blob], nome, { type: blob.type || 'application/octet-stream' }));
          await cache.delete(req);
        }
        if (files.length) handleFiles(files);
      } catch {
        /* niente da raccogliere */
      }
      history.replaceState(null, '', location.pathname);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In locale: salva le righe su questo dispositivo a ogni modifica.
  // In sync: la fonte è Firestore (con la sua cache offline), non localStorage.
  useEffect(() => {
    if (syncOn) return;
    localStorage.setItem(ROWS_STORAGE, JSON.stringify(rows));
  }, [rows, syncOn]);

  // Blob originale dall'archivio locale, come File (per caricarlo nel cloud).
  async function leggiFileLocale(id) {
    try {
      const rec = await leggiDocumento(id);
      if (!rec?.blob) return null;
      return new File([rec.blob], rec.name || '', { type: rec.type || rec.blob.type });
    } catch {
      return null;
    }
  }

  // Avvio della sincronizzazione: prima porta nel cloud i documenti che erano
  // solo su questo dispositivo (una volta sola), poi ascolta in tempo reale.
  useEffect(() => {
    if (!syncOn) return;
    let vivo = true;
    let stacca = null;
    (async () => {
      try {
        const locali = JSON.parse(localStorage.getItem(ROWS_STORAGE) || '[]');
        if (locali.length) {
          const remote = await leggiTutteRemote();
          await spingiLocaliNelCloud(locali.map(sanificaRiga), remote, leggiFileLocale);
          localStorage.removeItem(ROWS_STORAGE);
        }
      } catch {
        /* la migrazione può fallire senza bloccare l'ascolto */
      }
      try {
        const off = await avviaSync({
          onRows: (righe) => {
            if (vivo) setRows(righe.map(conDefault));
          },
          onErrore: () => mostraAvviso('Sincronizzazione: connessione assente, riprovo da solo.'),
        });
        if (vivo) stacca = off;
        else off();
      } catch {
        mostraAvviso('Sincronizzazione non disponibile: controlla la configurazione Firebase.');
      }
    })();
    return () => {
      vivo = false;
      if (stacca) stacca();
    };
  }, [syncOn]);

  function mostraAvviso(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  // Aggiorna una riga in locale e, se la sync è attiva, la propaga nel cloud.
  function patch(id, changes) {
    const attuale = rowsRef.current.find((r) => r.id === id);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    if (syncOn && attuale) salvaRiga({ ...attuale, ...changes }).catch(() => {});
  }

  async function processRow(id) {
    let file = filesRef.current.get(id);
    if (!file) {
      // Dopo un riavvio il file non è più in memoria: recuperalo dall'archivio
      // locale o, in sincronizzazione, scaricalo dal cloud.
      try {
        const rec = await leggiDocumento(id);
        if (rec) {
          file = rec.blob;
          filesRef.current.set(id, file);
        }
      } catch {
        /* archivio non disponibile: gestito sotto */
      }
      if (!file && syncOn) {
        const blob = await ottieniFile(id);
        if (blob) {
          const nome = rowsRef.current.find((r) => r.id === id)?.fileName || '';
          file = new File([blob], nome, { type: blob.type });
          filesRef.current.set(id, file);
          salvaDocumento(id, file).catch(() => {});
        }
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
      if (syncOn) caricaFile(id, file).catch(() => {});
      return {
        id,
        fileName: file.name,
        status: 'queued',
        tipo: 'acquisto',
        controparte: '',
        data: '',
        scadenza: '',
        partita_iva: '',
        imponibile: 0,
        iva: 0,
        totale: 0,
        categoria: 'Altro',
        pagato: false,
        acconto: 0,
        metodo: '',
        nota: '',
        notaCredito: false,
        error: '',
      };
    });
    setRows((rs) => [...rs, ...newRows]);
    newRows.forEach((r) => {
      if (syncOn) salvaRiga(r).catch(() => {});
      enqueue(r.id);
    });
  }

  function handleEdit(id, changes) {
    patch(id, changes);
    // Le correzioni manuali su controparte/categoria/P.IVA vanno ricordate
    // per i prossimi documenti della stessa controparte.
    if ('categoria' in changes || 'controparte' in changes || 'partita_iva' in changes) {
      const row = rowsRef.current.find((r) => r.id === id);
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
    if (syncOn) eliminaRiga(id).catch(() => {});
  }

  function handleClear() {
    const messaggio = syncOn
      ? 'Vuoi svuotare la tabella su TUTTI i dispositivi sincronizzati? I documenti e le scansioni verranno eliminati ovunque.'
      : 'Vuoi davvero svuotare la tabella? I dati non esportati e i file archiviati andranno persi.';
    if (window.confirm(messaggio)) {
      if (syncOn) rowsRef.current.forEach((r) => eliminaRiga(r.id).catch(() => {}));
      filesRef.current.clear();
      svuotaDocumenti().catch(() => {});
      setRows([]);
    }
  }

  async function handleOpenFile(id) {
    try {
      const rec = await leggiDocumento(id);
      let blob = rec?.blob || null;
      if (!blob && syncOn) {
        blob = await ottieniFile(id);
        if (blob) {
          const nome = rowsRef.current.find((r) => r.id === id)?.fileName || '';
          salvaDocumento(id, new File([blob], nome, { type: blob.type })).catch(() => {});
        }
      }
      if (!blob) {
        mostraAvviso(
          syncOn
            ? 'Scansione non ancora disponibile nel cloud.'
            : 'Il documento originale non è archiviato su questo dispositivo.'
        );
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      mostraAvviso('Impossibile aprire il documento.');
    }
  }

  // Import "aggiungi": dal backup arrivano solo le righe non già presenti.
  function handleAggiungiRighe(nuove) {
    if (nuove.length === 0) return;
    const pulite = nuove.map(sanificaRiga);
    setRows((rs) => [...rs, ...pulite]);
    if (syncOn) pulite.forEach((r) => salvaRiga(r).catch(() => {}));
  }

  // Import "sostituisci": il backup rimpiazza in blocco i dati del dispositivo.
  function handleSostituisciRighe(righe) {
    filesRef.current.clear();
    const pulite = righe.map(sanificaRiga);
    if (syncOn) {
      rowsRef.current.forEach((r) => eliminaRiga(r.id).catch(() => {}));
      pulite.forEach((r) => salvaRiga(r).catch(() => {}));
    }
    setRows(pulite);
  }

  // Attiva la sincronizzazione: genera un codice e ricarica in modalità sync
  // (la migrazione dei dati locali avviene all'avvio).
  function handleAttivaSync() {
    setSyncCode(generaSyncCode());
    location.reload();
  }

  // Disattiva su questo dispositivo: salva i dati attuali in locale, così non
  // spariscono, poi torna in modalità locale.
  function handleDisattivaSync() {
    try {
      localStorage.setItem(ROWS_STORAGE, JSON.stringify(rowsRef.current));
    } catch {
      /* se non riesce a salvare, i dati restano comunque nel cloud */
    }
    setSyncCode('');
    location.reload();
  }

  const busy = rows.some((r) => r.status === 'queued' || r.status === 'processing');
  const righeVisibili = filtraRighe(rows, filtri);
  const ciSonoFiltri = filtriAttivi(filtri);
  const nProblemi = contaProblemi(rows);
  const mesiDisponibili = [...new Set(rows.map((r) => chiaveMese(r.data)).filter(Boolean))].sort(
    (a, b) => b.localeCompare(a)
  );
  const urgenti = scadenzeUrgenti(rows);

  const euroFormat = new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const totalePer = (tipo) =>
    euroFormat.format(
      righeVisibili
        .filter((r) => r.tipo === tipo)
        .reduce((acc, r) => acc + netto(r, 'totale'), 0)
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
        <div className="header-actions">
          {syncOn && (
            <span className="sync-pill" title="I documenti si sincronizzano tra i tuoi dispositivi">
              ☁ Sincronizzato
            </span>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => setShowSettings(true)}
            title="Impostazioni"
            aria-label="Impostazioni"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="main">
        <DropZone onFiles={handleFiles} />

        <Dashboard
          rows={rows}
          onVaiScadenze={() => setView('scadenze')}
          onVaiRiepilogo={() => setView('riepilogo')}
          onVaiControllare={() => {
            setView('documenti');
            setFiltri({ ...FILTRI_VUOTI, daControllare: true });
          }}
        />

        <section className="card table-card">
          <div className="tabs">
            <button
              className={'tab' + (view === 'documenti' ? ' active' : '')}
              onClick={() => setView('documenti')}
            >
              Documenti
            </button>
            <button
              className={'tab' + (view === 'scadenze' ? ' active' : '')}
              onClick={() => setView('scadenze')}
            >
              Scadenze
              {urgenti > 0 && <span className="tab-badge">{urgenti}</span>}
            </button>
            <button
              className={'tab' + (view === 'riepilogo' ? ' active' : '')}
              onClick={() => setView('riepilogo')}
            >
              Riepilogo mensile
            </button>
            <button
              className={'tab' + (view === 'grafici' ? ' active' : '')}
              onClick={() => setView('grafici')}
            >
              Grafici
            </button>
            {(view === 'riepilogo' || view === 'scadenze' || view === 'grafici') && (
              <button className="btn btn-ghost tabs-print" onClick={() => window.print()}>
                🖨 Stampa
              </button>
            )}
          </div>

          {view === 'documenti' && (
            <>
              <div className="toolbar">
                <div className="toolbar-info">
                  {ciSonoFiltri ? (
                    <>
                      <strong>{righeVisibili.length}</strong> di {rows.length}{' '}
                      {rows.length === 1 ? 'documento' : 'documenti'}
                    </>
                  ) : (
                    <>
                      <strong>{rows.length}</strong>{' '}
                      {rows.length === 1 ? 'documento' : 'documenti'}
                    </>
                  )}
                  {righeVisibili.length > 0 && (
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
                    onClick={() => exportCsv(righeVisibili)}
                    disabled={righeVisibili.length === 0}
                    title={
                      ciSonoFiltri
                        ? 'Esporta solo i documenti mostrati dai filtri'
                        : 'Esporta tutti i documenti'
                    }
                  >
                    ⬇ Esporta Excel
                  </button>
                </div>
              </div>
              {rows.length > 0 && (
                <Filtri
                  filtri={filtri}
                  onChange={setFiltri}
                  mesi={mesiDisponibili}
                  nProblemi={nProblemi}
                />
              )}
              <DataTable
                rows={righeVisibili}
                vuotoPerFiltri={ciSonoFiltri}
                onEdit={handleEdit}
                onRetry={handleRetry}
                onDelete={handleDelete}
                onOpenFile={handleOpenFile}
              />
            </>
          )}
          {view === 'scadenze' && (
            <Scadenzario rows={rows} onEdit={handleEdit} onOpenFile={handleOpenFile} />
          )}
          {view === 'riepilogo' && <Riepilogo rows={rows} />}
          {view === 'grafici' && <Grafici rows={rows} mesi={mesiDisponibili} />}
        </section>
      </main>

      <footer className="footer">
        {syncOn
          ? 'Documenti sincronizzati tra i tuoi dispositivi · Estrazione con Google Gemini'
          : 'I dati restano su questo dispositivo · Estrazione con Google Gemini'}
      </footer>

      {showSettings && (
        <ApiKeyModal
          onClose={() => setShowSettings(false)}
          rows={rows}
          onAggiungiRighe={handleAggiungiRighe}
          onSostituisciRighe={handleSostituisciRighe}
          syncConfig={syncConfigurato()}
          syncOn={syncOn}
          syncCode={syncOn ? getSyncCode() : ''}
          onAttivaSync={handleAttivaSync}
          onDisattivaSync={handleDisattivaSync}
          onApriRiconciliazione={() => setShowRiconcilia(true)}
        />
      )}
      {showRiconcilia && (
        <Riconciliazione rows={rows} onEdit={handleEdit} onClose={() => setShowRiconcilia(false)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
