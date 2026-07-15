// ============================================================================
//  CONFIGURAZIONE — Cantina Micheletti (Castagneto Carducci)
//  Questo è il file da toccare quando vuoi migliorare l'estrazione.
//  Dopo ogni modifica: git push → l'app si aggiorna da sola ovunque.
// ============================================================================

// Modello Gemini da usare. "gemini-3.1-flash-lite" è pensato da Google apposta
// per estrazione dati semplice e ha un tetto gratuito di 500 richieste/giorno
// (contro le 20/giorno di "gemini-2.5-flash", verificato il 15/07/2026 sul
// progetto "Default Gemini Project"). Se un documento difficile viene letto
// male, prova "gemini-2.5-pro" (più capace ma con limiti gratuiti più bassi).
export const GEMINI_MODEL = 'gemini-3.1-flash-lite';

// Le categorie usate per classificare i documenti. Se ne aggiungi o togli una,
// aggiorna anche la spiegazione nel prompt qui sotto.
export const CATEGORIES = [
  'Vendita vino',
  'Imballaggi',
  'Attrezzature',
  'Prodotti enologici',
  'Utenze',
  'Servizi e trasporti',
  'Altro',
];

// Il prompt inviato a Gemini insieme a ogni documento.
export const EXTRACTION_PROMPT = `
Sei l'assistente contabile della Cantina Micheletti di Castagneto Carducci,
un'azienda che produce e vende vino a supermercati, ristoranti, enoteche e privati.
Analizza il documento allegato (fattura, bolletta, ricevuta o nota) ed estrai questi dati:

- tipo: "vendita" se il documento è emesso DALLA Cantina Micheletti (vino o prodotti
  della cantina venduti a un cliente); "acquisto" se la Cantina Micheletti è il
  DESTINATARIO del documento (merci o servizi comprati da altri).
- controparte: la ragione sociale dell'altra parte rispetto alla Cantina Micheletti
  (il cliente in caso di vendita, il fornitore in caso di acquisto).
  Non scrivere mai "Micheletti" in questo campo.
- data: la data di emissione del documento, in formato GG/MM/AAAA
- partita_iva: la Partita IVA della controparte (11 cifre, senza il prefisso "IT");
  se la controparte è un privato senza P.IVA, stringa vuota
- imponibile: l'importo imponibile complessivo, in euro
- iva: l'importo dell'IVA in euro (l'importo, non l'aliquota percentuale)
- totale: l'importo totale del documento, in euro
- categoria: una sola tra queste:
  · "Vendita vino" → vino o prodotti della cantina venduti ai clienti
  · "Imballaggi" → bottiglie, tappi, capsule, etichette, cartoni, gabbiette
  · "Attrezzature" → macchinari, strumentazione, botti, barrique, serbatoi, manutenzioni tecniche
  · "Prodotti enologici" → lieviti, enzimi, solfiti, chiarificanti, prodotti per vinificazione e vigna
  · "Utenze" → luce, acqua, gas, telefono, internet
  · "Servizi e trasporti" → corrieri, spedizioni, consulenze, assicurazioni, servizi vari
  · "Altro" → tutto ciò che non rientra nelle voci sopra

Regole:
- Gli importi sono numeri puri: punto come separatore decimale, niente simbolo €.
- Se ci sono più aliquote IVA, somma i relativi importi.
- Se un dato non è presente nel documento, usa "" per i testi e 0 per i numeri.
`.trim();

// Schema della risposta: obbliga Gemini a restituire un JSON con questi campi.
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tipo: { type: 'STRING', enum: ['acquisto', 'vendita'] },
    controparte: { type: 'STRING' },
    data: { type: 'STRING', description: 'Data di emissione in formato GG/MM/AAAA' },
    partita_iva: { type: 'STRING' },
    imponibile: { type: 'NUMBER' },
    iva: { type: 'NUMBER' },
    totale: { type: 'NUMBER' },
    categoria: { type: 'STRING', enum: CATEGORIES },
  },
  required: ['tipo', 'controparte', 'data', 'partita_iva', 'imponibile', 'iva', 'totale', 'categoria'],
};
