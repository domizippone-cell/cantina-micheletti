# Sincronizzazione tra dispositivi — setup (una volta sola)

Questo abilita l'aggiornamento automatico dei documenti tra PC e telefono, senza
esportare/importare backup. Serve un progetto **Firebase** gratuito (è di Google).
Lo fai tu una volta; tuo suocero non tocca niente e non fa nessun login.

Tempo richiesto: ~5–10 minuti.

---

## 1. Crea il progetto Firebase

1. Vai su <https://console.firebase.google.com> (accedi con il tuo account Google).
2. **Aggiungi progetto** → dai un nome (es. `cantina-micheletti`) → puoi
   disattivare Google Analytics → **Crea progetto**.

## 2. Crea l'app Web e copia la configurazione

1. Nella panoramica del progetto, clicca l'icona **Web** `</>`.
2. Dai un nome all'app (es. `cantina`) → **Registra app**.
3. Comparirà un blocco `const firebaseConfig = { ... }`. Copia quei valori.
4. Aprili in `src/firebaseConfig.js` e incollali al posto delle stringhe vuote:

   ```js
   export const firebaseConfig = {
     apiKey: 'AIza…',
     authDomain: 'cantina-micheletti.firebaseapp.com',
     projectId: 'cantina-micheletti',
     storageBucket: 'cantina-micheletti.appspot.com',
     messagingSenderId: '1234567890',
     appId: '1:1234567890:web:abcdef…',
   };
   ```

   > Questi valori NON sono segreti: in Firebase la config web è pubblica di
   > proposito. La sicurezza è garantita dalle Regole (passo 5) e dal codice di
   > sincronizzazione. Vanno bene anche con il repository pubblico.

## 3. Attiva Firestore (i dati delle fatture)

1. Menu a sinistra → **Build → Firestore Database** → **Crea database**.
2. Scegli una zona europea (es. `eur3` / `europe-west`) → **Avvia in modalità
   produzione** (le regole le mettiamo noi al passo 5).

## 4. Attiva Storage (le scansioni originali) e l'accesso anonimo

1. **Build → Storage** → **Inizia** → conferma la stessa zona.
2. **Build → Authentication** → **Inizia** → scheda **Sign-in method** →
   abilita **Anonimo** → **Salva**.

## 5. Incolla le Regole di sicurezza

Le regole fanno sì che si acceda solo conoscendo un codice lungo e segreto.

**Firestore** (scheda *Regole* in Firestore Database):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cantine/{codice}/documenti/{docId} {
      allow read, write: if request.auth != null && codice.size() >= 20;
    }
  }
}
```

**Storage** (scheda *Regole* in Storage):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /cantine/{codice}/{docId} {
      allow read, write: if request.auth != null && codice.size() >= 20;
    }
  }
}
```

Premi **Pubblica** su entrambe.

## 6. Pubblica e attiva

1. Salva `src/firebaseConfig.js`, poi `git push` (Vercel ripubblica da solo).
2. Apri l'app → ⚙️ → **Sincronizzazione tra dispositivi** → **Attiva
   sincronizzazione**. L'app ricarica in modalità sincronizzata e i documenti
   già presenti su questo dispositivo vengono caricati nel cloud.
3. Copia il **link** che compare (contiene `#sync=…`) e aprilo sull'altro
   dispositivo (telefono): vedrà subito gli stessi documenti, in tempo reale.

Da quel momento: carichi una fattura ovunque → compare su tutti i dispositivi da
sola. Niente più export/import.

---

## Note

- **Costi:** il piano gratuito Firebase (Spark) è ampiamente sufficiente per
  l'uso di una cantina (poche fatture al giorno). Nessuna carta richiesta.
- **Privacy:** con la sync attiva i dati delle fatture vivono nel cloud Firebase
  (prima restavano solo sul dispositivo), protetti dal codice segreto del link.
- **Il codice di sincronizzazione è come una password:** condividilo solo con i
  tuoi dispositivi. Chi ha il link vede i documenti.
- **Disattivare:** ⚙️ → «disattivare la sincronizzazione su questo dispositivo».
  I dati restano nel cloud e sull'altro dispositivo; questo torna in locale.
- **Cambiare codice:** basta disattivare e riattivare (genera un codice nuovo).
