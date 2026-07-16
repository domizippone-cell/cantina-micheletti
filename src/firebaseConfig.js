// ============================================================================
//  CONFIGURAZIONE FIREBASE — la incolli TU una volta sola.
//
//  A cosa serve: è il "punto d'incontro" nel cloud che permette ai dispositivi
//  (PC, telefono…) di condividere le fatture in tempo reale. Senza questa
//  configurazione l'app funziona lo stesso, ma solo in locale, come prima.
//
//  Questi valori NON sono segreti: in Firebase la config web è pubblica di
//  proposito. La sicurezza dei dati è garantita dalle Regole (che imposti tu
//  nella console) e dal "codice di sincronizzazione" segreto che condividi
//  solo tra i tuoi dispositivi. Per questo si possono tenere nel codice anche
//  con il repository pubblico.
//
//  COME OTTENERLI (~5 minuti), guida completa in SETUP_SYNC.md:
//   1. console.firebase.google.com → "Aggiungi progetto"
//   2. Crea un'app Web (</>) → copia l'oggetto firebaseConfig qui sotto
//   3. Attiva: Firestore Database, Storage, Authentication → Accesso anonimo
//   4. Incolla le Regole indicate in SETUP_SYNC.md
//  Fatto questo: git push → l'app si aggiorna ovunque e la sync è attiva.
// ============================================================================

export const firebaseConfig = {
  apiKey: 'AIzaSyD6S4JOJp08qbmY4rK_GBjEoe7x-zWSplU',
  authDomain: 'cantina-micheletti.firebaseapp.com',
  projectId: 'cantina-micheletti',
  storageBucket: 'cantina-micheletti.firebasestorage.app',
  messagingSenderId: '156255090355',
  appId: '1:156255090355:web:a8504a26e10a6b042fa2c6',
};

// Sync considerata configurata solo se i campi essenziali sono compilati.
export function syncConfigurato() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.storageBucket);
}
