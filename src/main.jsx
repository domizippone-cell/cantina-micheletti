import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { setApiKey } from './gemini.js';
import './styles.css';

// Setup a distanza: aprendo l'app con  #key=LA_CHIAVE  la chiave viene salvata
// su questo dispositivo e sparisce subito dall'indirizzo. Il frammento dopo #
// non viene mai inviato al server.
const match = location.hash.match(/key=([^&]+)/);
if (match) {
  setApiKey(decodeURIComponent(match[1]));
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
