// Inizializzazione di Firebase, a caricamento pigro: il pesante SDK viene
// importato solo quando la sincronizzazione è configurata e attiva, così chi
// usa l'app solo in locale non paga nulla.

import { firebaseConfig, syncConfigurato } from './firebaseConfig.js';

let _app = null;
let _db = null;
let _storage = null;
let _authPronta = null;

async function initApp() {
  if (_app) return _app;
  const { initializeApp } = await import('firebase/app');
  _app = initializeApp(firebaseConfig);
  return _app;
}

// Firestore con cache locale persistente: l'app funziona anche offline e
// sincronizza da sola appena torna la connessione.
export async function getDb() {
  if (_db) return _db;
  const app = await initApp();
  const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } = await import(
    'firebase/firestore'
  );
  try {
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Se la cache persistente non è disponibile (es. modalità privata), ripiega
    // su Firestore in memoria: la sync funziona comunque quando c'è rete.
    const { getFirestore } = await import('firebase/firestore');
    _db = getFirestore(app);
  }
  return _db;
}

export async function getStorage() {
  if (_storage) return _storage;
  const app = await initApp();
  const { getStorage: gs } = await import('firebase/storage');
  _storage = gs(app);
  return _storage;
}

// Accesso anonimo: nessun login per l'utente, ma le Regole possono comunque
// pretendere un utente autenticato. Si esegue una volta sola.
export async function assicuraAutenticazione() {
  if (_authPronta) return _authPronta;
  _authPronta = (async () => {
    const app = await initApp();
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import('firebase/auth');
    const auth = getAuth(app);
    if (auth.currentUser) return auth.currentUser;
    await signInAnonymously(auth);
    return new Promise((resolve) => {
      const off = onAuthStateChanged(auth, (user) => {
        if (user) {
          off();
          resolve(user);
        }
      });
    });
  })();
  return _authPronta;
}

export { syncConfigurato };
