// Piccolo archivio IndexedDB, separato da quello dei documenti, per i
// "promemoria scadenze". Lo condividono la pagina (che lo aggiorna) e il
// service worker (che, quando il browser lo sveglia, legge cosa notificare).
// Sta a parte apposta: così il service worker non dipende dal resto dell'app.

const DB_NAME = 'micheletti-promemoria';
const STORE = 'items';

function apri() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Sostituisce in blocco l'elenco dei promemoria.
export async function scriviPromemoria(items) {
  const db = await apri();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      st.clear();
      for (const it of items) st.put(it);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function leggiPromemoria() {
  const db = await apri();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

// Segna alcuni promemoria come già notificati in una certa data (AAAA-MM-GG),
// così non vengono ripresentati più volte lo stesso giorno.
export async function segnaNotificati(ids, giorno) {
  if (!ids.length) return;
  const db = await apri();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      for (const id of ids) {
        const req = st.get(id);
        req.onsuccess = () => {
          const it = req.result;
          if (it) st.put({ ...it, notificatoIl: giorno });
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
