// Layer di sincronizzazione tra dispositivi.
//
// Idea: tutti i dispositivi che conoscono lo stesso "codice di sincronizzazione"
// leggono e scrivono nella stessa area di Firestore, in tempo reale. Le
// scansioni originali vanno su Firebase Storage. Nessun login: si entra con
// accesso anonimo e il codice — segreto e non indovinabile — viaggia nel link
// (`#sync=CODICE`), esattamente come la chiave API.
//
// Il codice qui NON dipende dai componenti React: espone funzioni semplici che
// App.jsx richiama. Se la sync non è configurata/attiva, non viene mai usato.

import { getDb, getStorage, assicuraAutenticazione, syncConfigurato } from './firebase.js';

const CODE_STORAGE = 'estrattore.syncCode';

export { syncConfigurato };

export function getSyncCode() {
  return localStorage.getItem(CODE_STORAGE) || '';
}

export function setSyncCode(code) {
  const pulito = String(code || '').trim();
  if (pulito) localStorage.setItem(CODE_STORAGE, pulito);
  else localStorage.removeItem(CODE_STORAGE);
}

// Sync utilizzabile solo se è sia configurata (Firebase) sia attivata (codice).
export function syncAttiva() {
  return syncConfigurato() && Boolean(getSyncCode());
}

// Codice lungo e casuale: è l'unico segreto che protegge i dati condivisi.
export function generaSyncCode() {
  const alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const buf = new Uint32Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => alfabeto[n % alfabeto.length]).join('');
}

// Solo campi "dato": niente valori transitori o non serializzabili.
function rigaPerCloud(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  if (out._creato == null) out._creato = Date.now();
  return out;
}

async function collezione() {
  const db = await getDb();
  const { collection } = await import('firebase/firestore');
  return collection(db, 'cantine', getSyncCode(), 'documenti');
}

async function rifDoc(id) {
  const db = await getDb();
  const { doc } = await import('firebase/firestore');
  return doc(db, 'cantine', getSyncCode(), 'documenti', id);
}

async function rifFile(id) {
  const storage = await getStorage();
  const { ref } = await import('firebase/storage');
  return ref(storage, `cantine/${getSyncCode()}/${id}`);
}

// Ascolta in tempo reale i documenti condivisi. Ogni cambiamento (da questo o
// da un altro dispositivo) richiama onRows con l'elenco aggiornato.
// Restituisce una funzione per interrompere l'ascolto.
export async function avviaSync({ onRows, onErrore }) {
  await assicuraAutenticazione();
  const col = await collezione();
  const { onSnapshot, query, orderBy } = await import('firebase/firestore');
  const q = query(col, orderBy('_creato', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const righe = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onRows(righe);
    },
    (err) => onErrore && onErrore(err)
  );
}

// Legge una volta sola tutti i documenti remoti (usata per la migrazione).
export async function leggiTutteRemote() {
  await assicuraAutenticazione();
  const { getDocs } = await import('firebase/firestore');
  const snap = await getDocs(await collezione());
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function salvaRiga(row) {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(await rifDoc(row.id), rigaPerCloud(row));
}

export async function eliminaRiga(id) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(await rifDoc(id));
  try {
    const { deleteObject } = await import('firebase/storage');
    await deleteObject(await rifFile(id));
  } catch {
    /* il file poteva non esserci: ignora */
  }
}

export async function caricaFile(id, file) {
  const { uploadBytes } = await import('firebase/storage');
  await uploadBytes(await rifFile(id), file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: { nome: file.name || '' },
  });
}

// Scarica dal cloud una scansione non presente in locale (aperta da un altro
// dispositivo). Restituisce un Blob, o null se non c'è.
export async function ottieniFile(id) {
  try {
    const { getBlob } = await import('firebase/storage');
    return await getBlob(await rifFile(id));
  } catch {
    return null;
  }
}

// Migrazione: al primo avvio della sync, carica nel cloud i documenti che
// esistono solo su questo dispositivo. `leggiFileLocale(id)` restituisce il
// Blob originale dall'archivio locale (o null). Con dedup per impronta, così
// la stessa fattura già nel cloud (magari con id diverso) non viene duplicata.
export async function spingiLocaliNelCloud(righeLocali, remoteEsistenti, leggiFileLocale) {
  const idRemoti = new Set(remoteEsistenti.map((r) => r.id));
  const impronteRemote = new Set(remoteEsistenti.map(impronta));
  let caricate = 0;
  for (const row of righeLocali) {
    if (!row?.id) continue;
    if (idRemoti.has(row.id) || impronteRemote.has(impronta(row))) continue;
    try {
      const file = leggiFileLocale ? await leggiFileLocale(row.id) : null;
      if (file) await caricaFile(row.id, file);
      await salvaRiga(row);
      caricate += 1;
    } catch {
      /* un documento problematico non blocca gli altri */
    }
  }
  return caricate;
}

// Stessa "impronta" usata nel backup: riconosce la stessa fattura a
// prescindere dall'id (utile quando è stata caricata su due dispositivi).
function impronta(r) {
  const chi = /^\d{11}$/.test(r.partita_iva || '')
    ? 'piva:' + r.partita_iva
    : String(r.controparte || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return [
    r.tipo,
    chi,
    r.data || '',
    (Number(r.imponibile) || 0).toFixed(2),
    (Number(r.iva) || 0).toFixed(2),
    (Number(r.totale) || 0).toFixed(2),
  ].join('|');
}
