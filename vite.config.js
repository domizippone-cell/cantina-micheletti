import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "autoUpdate": quando pubblichi una nuova versione, l'app sul PC di
      // chi la usa si aggiorna e ricarica da sola. I dati in tabella non si
      // perdono perché vengono salvati in localStorage a ogni modifica.
      registerType: 'autoUpdate',
      // Service worker scritto a mano (src/sw.js): serve per ricevere i file
      // condivisi da altre app e per i promemoria delle scadenze.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        // I documenti originali (PDF/foto) possono essere grandi: alziamo il
        // limite così il precache non salta i chunk dell'app.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'Cantina Micheletti — Documenti',
        short_name: 'Cantina',
        description: 'Estrae i dati dalle fatture di acquisto e vendita della Cantina Micheletti',
        lang: 'it',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8f5f1',
        theme_color: '#8e2043',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        // "Share target": fa comparire "Cantina Micheletti" nel menu Condividi
        // del telefono. I file arrivano in POST a /share-target, gestito dal SW.
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            files: [
              {
                name: 'file',
                accept: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/*']
              }
            ]
          }
        }
      }
    })
  ]
});
