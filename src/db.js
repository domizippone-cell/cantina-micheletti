// Archivio dei documenti originali (PDF e foto) in IndexedDB.
// Come il resto dei dati, i file restano solo su questo dispositivo.

const DB_NAME = 'estrattore';
const STORE = 'documenti';

function apriDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function conStore(mode, azione) {
  const db = await apriDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = azione(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function salvaDocumento(id, file) {
  return conStore('readwrite', (st) => st.put({ blob: file, name: file.name, type: file.type }, id));
}

export function leggiDocumento(id) {
  return conStore('readonly', (st) => st.get(id));
}

export function eliminaDocumento(id) {
  return conStore('readwrite', (st) => st.delete(id));
}

export function svuotaDocumenti() {
  return conStore('readwrite', (st) => st.clear());
}
