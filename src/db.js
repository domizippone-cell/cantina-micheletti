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

// Usata dall'import di un backup, dove il file arriva già come record.
export function salvaRecord(id, record) {
  return conStore('readwrite', (st) => st.put(record, id));
}

// Tutti i documenti archiviati, come [{ id, blob, name, type }].
// Chiavi e valori vengono letti nella STESSA transazione: IndexedDB li
// restituisce entrambi ordinati per chiave, così restano allineati.
export async function tuttiDocumenti() {
  const db = await apriDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const st = tx.objectStore(STORE);
      const chiavi = st.getAllKeys();
      const valori = st.getAll();
      tx.oncomplete = () => resolve(chiavi.result.map((id, i) => ({ id, ...valori.result[i] })));
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
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
