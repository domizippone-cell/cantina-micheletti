# Cantina Micheletti — Documenti

App web (PWA) su misura per la Cantina Micheletti (Castagneto Carducci): estrae i
dati da fatture, bollette e ricevute usando Google Gemini e li mette in una tabella
modificabile, esportabile in Excel.

Per ogni documento Gemini riconosce da solo:

- **Tipo**: *Vendita* (fattura emessa dalla cantina a supermercati, ristoranti,
  privati…) o *Acquisto* (bottiglie, tappi, cartoni, attrezzature, utenze…);
- **Cliente/Fornitore**: la controparte del documento;
- **Categoria**: Vendita vino, Imballaggi, Attrezzature, Prodotti enologici,
  Utenze, Servizi e trasporti, Altro (l'elenco si cambia in `src/config.js`);
- Data, Partita IVA, Imponibile, IVA e Totale.

La barra sopra la tabella mostra i totali separati di Vendite e Acquisti.

## Come funziona l'architettura

- **Solo frontend**: nessun server, nessun database. Il browser invia il PDF
  direttamente all'API di Gemini e mostra il risultato.
- **PWA installabile**: da Chrome/Edge si installa come app con icona sul desktop
  (o sulla home dello smartphone).
- **Aggiornamenti automatici**: a ogni `git push` l'hosting ripubblica il sito e il
  service worker aggiorna l'app su tutti i dispositivi entro un minuto, da sola.
- **Chiave API**: non è nel codice (il sito è raggiungibile da chiunque conosca
  l'URL). Si inserisce una volta per dispositivo e resta in `localStorage`.

## Sviluppo in locale

```bash
npm install
npm run dev        # apre su http://localhost:5173
```

## Configurare la chiave API

1. Crea una chiave gratuita su https://aistudio.google.com/apikey
2. Nell'app, clicca l'ingranaggio ⚙️ in alto a destra e incollala.

**Setup a distanza** (per il PC di tuo suocero): mandagli un link del tipo
`https://tua-app.vercel.app/#key=LA_TUA_CHIAVE` — aprendolo, la chiave viene
salvata sul suo dispositivo e rimossa subito dall'indirizzo. Il frammento dopo
`#` non transita mai dal server. Dopo il primo click può usare l'URL normale.

## Pubblicare (una volta sola)

1. Crea un repository su GitHub (va bene **privato**) e fai il push del progetto:
   ```bash
   git init
   git add .
   git commit -m "Prima versione"
   git remote add origin https://github.com/TUO_USER/estrattore-pdf.git
   git push -u origin main
   ```
2. Su https://vercel.com → "Add New Project" → importa il repository.
   Vercel riconosce Vite da solo: clicca **Deploy**. Fine.
3. L'app è online su `https://<nome>.vercel.app`.

### Aggiornare l'app (ogni volta che vuoi)

```bash
git add .
git commit -m "Descrizione della modifica"
git push
```

Vercel ripubblica in ~30 secondi. L'app installata sul PC di tuo suocero si
accorge della nuova versione (controlla ogni minuto, e comunque a ogni apertura)
e si ricarica da sola. I dati in tabella non si perdono: sono salvati sul
dispositivo.

## Installare l'app

- **PC (Chrome/Edge)**: apri l'URL → icona "Installa" nella barra dell'indirizzo
  (o menu ⋮ → *Trasmetti, salva e condividi* → *Installa app*). Compare l'icona sul
  desktop e nel menu Start.
- **Android**: Chrome → menu ⋮ → *Aggiungi a schermata Home*.
- **iPhone/iPad**: Safari → Condividi → *Aggiungi a schermata Home*.

## Dove mettere le mani

| Cosa vuoi cambiare | File |
| --- | --- |
| Prompt di estrazione, modello Gemini, campi | `src/config.js` |
| Grafica e colori | `src/styles.css` |
| Colonne della tabella | `src/components/DataTable.jsx` |
| Formato dell'export Excel | `src/csv.js` |
| Testi dell'interfaccia | `src/App.jsx` e `src/components/` |

## Note su costi e limiti

Con `gemini-2.5-flash` il piano gratuito di Google basta per un uso familiare
(decine di documenti al giorno). Se compare l'errore "troppi documenti in poco
tempo", basta attendere un minuto: l'app elabora i file uno alla volta proprio
per restare nei limiti.
