import { GEMINI_MODEL, EXTRACTION_PROMPT, RESPONSE_SCHEMA, CATEGORIES } from './config.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const KEY_STORAGE = 'estrattore.apiKey';

export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE) || '';
}

export function setApiKey(key) {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('FILE_READ'));
    reader.readAsDataURL(file);
  });
}

// Invia il documento a Gemini e restituisce i campi estratti.
export async function extractDocument(file) {
  const key = getApiKey();
  if (!key) throw new Error('NO_KEY');
  if (file.size > 15 * 1024 * 1024) throw new Error('TOO_BIG');

  const data = await fileToBase64(file);
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: file.type || 'application/pdf', data } },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  };

  const res = await fetch(`${API_BASE}/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error('BAD_KEY');
    if (res.status === 429) throw new Error('RATE_LIMIT');
    if (res.status >= 500) throw new Error('SERVER');
    throw new Error('HTTP_' + res.status);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('EMPTY');

  const fields = JSON.parse(text);
  return {
    tipo: fields.tipo === 'vendita' ? 'vendita' : 'acquisto',
    controparte: String(fields.controparte ?? ''),
    data: String(fields.data ?? ''),
    scadenza: String(fields.scadenza ?? ''),
    partita_iva: String(fields.partita_iva ?? ''),
    imponibile: Number(fields.imponibile) || 0,
    iva: Number(fields.iva) || 0,
    totale: Number(fields.totale) || 0,
    notaCredito: fields.nota_credito === true,
    categoria: CATEGORIES.includes(fields.categoria) ? fields.categoria : 'Altro',
  };
}

export function errorMessage(err) {
  switch (err?.message) {
    case 'NO_KEY': return 'Chiave API non configurata: aprila dall\'ingranaggio in alto.';
    case 'BAD_KEY': return 'Chiave API non valida o senza permessi. Controllala nelle impostazioni.';
    case 'RATE_LIMIT': return 'Troppi documenti in poco tempo: attendi un minuto e riprova.';
    case 'SERVER': return 'Servizio Google momentaneamente non disponibile: riprova tra poco.';
    case 'TOO_BIG': return 'File troppo grande (massimo 15 MB).';
    case 'FILE_READ': return 'Impossibile leggere il file.';
    case 'EMPTY': return 'Gemini non ha restituito dati per questo documento.';
    default:
      if (err instanceof TypeError) return 'Connessione assente: controlla internet e riprova.';
      return 'Errore imprevisto: ' + (err?.message || 'sconosciuto');
  }
}
