// Service worker personalizzato (strategia injectManifest di vite-plugin-pwa).
// Fa tre cose:
//  1) Precache dei file dell'app + aggiornamento automatico (come prima).
//  2) "Share target": riceve i file condivisi da WhatsApp/Gmail/Foto.
//  3) Promemoria scadenze in background dove il browser lo consente.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { leggiPromemoria, segnaNotificati } from './promemoria-idb.js';

// Aggiornamento automatico: la nuova versione prende il posto della vecchia
// senza che l'utente debba fare nulla (coerente con registerType 'autoUpdate').
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

const CACHE_CONDIVISI = 'condivisi';

// --- 2) Share target -------------------------------------------------------
// Quando dal telefono si fa "Condividi → Cantina Micheletti", il browser manda
// qui i file in POST. Li mettiamo da parte in una cache e rimandiamo l'utente
// all'app, che li raccoglie e li mette in coda per l'estrazione.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(gestisciCondivisione(event.request));
  }
});

async function gestisciCondivisione(request) {
  try {
    const form = await request.formData();
    const files = form.getAll('file').filter((f) => f && typeof f === 'object' && f.size);
    const cache = await caches.open(CACHE_CONDIVISI);
    let n = 0;
    for (const f of files) {
      const chiave = '/__condiviso__/' + Date.now() + '-' + n;
      await cache.put(
        new Request(chiave),
        new Response(f, {
          headers: {
            'content-type': f.type || 'application/octet-stream',
            'x-nome-file': encodeURIComponent(f.name || 'condiviso'),
          },
        })
      );
      n += 1;
    }
  } catch {
    /* se qualcosa va storto apriamo comunque l'app */
  }
  return Response.redirect('/?condivisi=1', 303);
}

// --- 3) Promemoria scadenze in background ---------------------------------
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'promemoria-scadenze') {
    event.waitUntil(controllaPromemoria());
  }
});

async function controllaPromemoria() {
  let items = [];
  try {
    items = await leggiPromemoria();
  } catch {
    return;
  }
  const oggi = new Date();
  const oggiISO =
    oggi.getFullYear() + '-' + String(oggi.getMonth() + 1).padStart(2, '0') + '-' + String(oggi.getDate()).padStart(2, '0');
  // Da notificare: scade oggi o è già scaduta, e non l'abbiamo già fatto oggi.
  const daNotificare = items.filter((i) => i.quando <= oggiISO && i.notificatoIl !== oggiISO);
  if (daNotificare.length === 0) return;
  const titolo =
    daNotificare.length === 1 ? 'Scadenza da gestire' : `${daNotificare.length} scadenze da gestire`;
  const corpo = daNotificare.slice(0, 4).map((i) => i.testo).join('\n');
  await self.registration.showNotification(titolo, {
    body: corpo,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'promemoria-scadenze',
  });
  try {
    await segnaNotificati(daNotificare.map((i) => i.id), oggiISO);
  } catch {
    /* non riusciamo a segnare: al massimo ripeterà, non è grave */
  }
}

// Cliccando la notifica si apre (o si porta in primo piano) l'app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
