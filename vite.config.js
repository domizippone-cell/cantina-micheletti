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
        ]
      }
    })
  ]
});
