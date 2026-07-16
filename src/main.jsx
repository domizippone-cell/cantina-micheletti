import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { setApiKey } from './gemini.js';
import { setSyncCode } from './sync.js';
import './styles.css';

// Setup a distanza tramite il frammento dopo #, che non viene mai inviato al
// server e viene ripulito subito dall'indirizzo:
//   #key=LA_CHIAVE    → salva la chiave API di Gemini su questo dispositivo
//   #sync=IL_CODICE   → collega questo dispositivo alla sincronizzazione
const chiave = location.hash.match(/key=([^&]+)/);
if (chiave) setApiKey(decodeURIComponent(chiave[1]));
const codiceSync = location.hash.match(/sync=([^&]+)/);
if (codiceSync) setSyncCode(decodeURIComponent(codiceSync[1]));
if (chiave || codiceSync) {
  history.replaceState(null, '', location.pathname + location.search);
}

// Controlla ogni minuto se è stata pubblicata una nuova versione:
// se sì, l'app si aggiorna e ricarica da sola (i dati restano salvati).
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update(), 60_000);
  },
});

createRoot(document.getElementById('root')).render(<App />);
