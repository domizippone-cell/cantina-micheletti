// Promemoria delle scadenze tramite notifiche del sistema.
//
// Realtà tecnica (onesta): senza un server che le invii, le notifiche "a app
// chiusa" sono possibili solo dove il browser supporta il Periodic Background
// Sync (Chrome su Android, PWA installata). Ovunque — anche su iPhone — resta
// comunque l'avviso all'APERTURA dell'app: appena il suocero la apre per
// caricare una fattura, se c'è una scadenza imminente riceve la notifica.

import { parseData, giorniDaOggi } from './date.js';
import { residuo } from './calcoli.js';
import { scriviPromemoria } from './promemoria-idb.js';

const FLAG = 'estrattore.notifiche';
const ULTIMO = 'estrattore.notifiche.ultimo';
const SOGLIA_GIORNI = 3; // avvisa per ciò che scade entro 3 giorni o è già scaduto

export function notificheSupportate() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permessoNotifiche() {
  return notificheSupportate() ? Notification.permission : 'denied';
}

export function notificheAbilitate() {
  return localStorage.getItem(FLAG) === '1' && permessoNotifiche() === 'granted';
}

function oggiISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function isoDaData(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Le scadenze aperte che meritano un promemoria, dalla più urgente.
export function promemoriaScadenze(rows) {
  return rows
    .filter((r) => r.status === 'done' && !r.pagato && !r.notaCredito && residuo(r) > 0)
    .map((r) => ({ r, d: parseData(r.scadenza) }))
    .filter((x) => x.d !== null && giorniDaOggi(x.d) <= SOGLIA_GIORNI)
    .sort((a, b) => a.d - b.d)
    .map(({ r, d }) => {
      const giorni = giorniDaOggi(d);
      const verbo = r.tipo === 'vendita' ? 'incassare' : 'pagare';
      const quando =
        giorni < 0 ? `scaduta da ${-giorni} gg` : giorni === 0 ? 'scade oggi' : giorni === 1 ? 'scade domani' : `tra ${giorni} gg`;
      return {
        id: r.id,
        quando: isoDaData(d),
        giorni,
        testo: `Da ${verbo}: ${r.controparte || r.fileName} — ${quando}`,
      };
    });
}

async function registrazioneSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

// Registra il Periodic Background Sync dove è supportato (best-effort).
async function registraSyncPeriodico(reg) {
  try {
    if (reg && 'periodicSync' in reg) {
      const stato = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (stato.state === 'granted') {
        await reg.periodicSync.register('promemoria-scadenze', { minInterval: 24 * 60 * 60 * 1000 });
      }
    }
  } catch {
    /* non supportato: pazienza, resta l'avviso all'apertura */
  }
}

// Chiede il permesso e attiva i promemoria. Restituisce true se attivati.
export async function attivaNotifiche() {
  if (!notificheSupportate()) return false;
  let permesso = Notification.permission;
  if (permesso !== 'granted') permesso = await Notification.requestPermission();
  if (permesso !== 'granted') return false;
  localStorage.setItem(FLAG, '1');
  const reg = await registrazioneSW();
  await registraSyncPeriodico(reg);
  return true;
}

export function disattivaNotifiche() {
  localStorage.setItem(FLAG, '');
}

// Mostra subito una notifica riassuntiva, al massimo una volta al giorno.
async function avvisaOra(items) {
  const urgenti = items.filter((i) => i.giorni <= 1); // scadute, oggi o domani
  if (urgenti.length === 0) return;
  if (localStorage.getItem(ULTIMO) === oggiISO()) return; // già avvisato oggi
  const reg = await registrazioneSW();
  const titolo =
    urgenti.length === 1 ? 'Scadenza in arrivo' : `${urgenti.length} scadenze in arrivo`;
  const corpo = urgenti.slice(0, 4).map((i) => i.testo).join('\n');
  const opzioni = { body: corpo, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'promemoria-scadenze' };
  try {
    if (reg) await reg.showNotification(titolo, opzioni);
    else new Notification(titolo, opzioni);
    localStorage.setItem(ULTIMO, oggiISO());
  } catch {
    /* niente notifica: non è un errore bloccante */
  }
}

// Da chiamare quando cambiano le righe: aggiorna l'elenco per il service worker
// e, se serve, mostra subito l'avviso. Non fa nulla se le notifiche sono spente.
export async function aggiornaPromemoria(rows) {
  if (!notificheAbilitate()) return;
  const items = promemoriaScadenze(rows);
  try {
    await scriviPromemoria(items.map((i) => ({ id: i.id, quando: i.quando, testo: i.testo })));
  } catch {
    /* IndexedDB non disponibile: resta comunque l'avviso all'apertura */
  }
  const reg = await registrazioneSW();
  await registraSyncPeriodico(reg);
  await avvisaOra(items);
}
