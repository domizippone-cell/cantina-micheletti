// Riconciliazione con l'estratto conto della banca.
//
// Legge il CSV scaricato dalla banca (i formati variano parecchio), ne ricava
// i movimenti e li prova ad abbinare alle fatture ancora aperte, per capacità:
// un'uscita ~ una fattura da pagare, un'entrata ~ una fattura da incassare,
// quando gli importi combaciano. L'utente conferma gli abbinamenti proposti.

import { parseData, parseISO } from './date.js';
import { parseImporto, residuo } from './calcoli.js';

const TOLLERANZA = 0.02; // due centesimi di scarto sono accettabili

// Divide una riga CSV rispettando le virgolette.
function dividiRiga(riga, sep) {
  const out = [];
  let cur = '';
  let dentro = false;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (c === '"') {
      if (dentro && riga[i + 1] === '"') { cur += '"'; i++; }
      else dentro = !dentro;
    } else if (c === sep && !dentro) {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function rilevaSeparatore(righe) {
  const riga = righe.find((l) => l.trim()) || '';
  const candidati = [';', '\t', ','];
  let best = ';';
  let bestN = -1;
  for (const c of candidati) {
    const n = riga.split(c).length - 1;
    if (n > bestN) { bestN = n; best = c; }
  }
  return best;
}

// Interpreta una data in vari formati comuni negli estratti conto.
function parseDataFlessibile(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  let d = parseData(s); // GG/MM/AAAA
  if (d) return d;
  d = parseISO(s); // AAAA-MM-GG
  if (d) return d;
  const m = /^(\d{1,2})[-.](\d{1,2})[-.](\d{2,4})$/.exec(s); // GG-MM-AAAA o GG.MM.AA
  if (m) {
    const anno = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const dt = new Date(anno, Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

// Riconosce se una stringa è un importo (numero con decimali/segno).
function pareImporto(str) {
  const s = String(str || '').trim();
  if (!s) return false;
  return /^[-+]?[\d.,]+$/.test(s.replace(/[€\s]/g, '')) && /\d/.test(s);
}

function cercaIndice(intestazioni, regex) {
  return intestazioni.findIndex((h) => regex.test(h));
}

// Legge il testo del CSV e restituisce { movimenti, avviso }.
// movimenti: [{ data: Date|null, importo: number(segno), descrizione }].
export function parseEstrattoConto(testo) {
  const righe = String(testo || '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length);
  if (righe.length === 0) return { movimenti: [], avviso: 'Il file è vuoto.' };

  const sep = rilevaSeparatore(righe);

  // Cerca una riga di intestazione con "data" e qualcosa di monetario.
  let idxHeader = -1;
  for (let i = 0; i < Math.min(righe.length, 15); i++) {
    const celle = dividiRiga(righe[i], sep).map((c) => c.toLowerCase());
    const haData = celle.some((c) => /data/.test(c));
    const haSoldi = celle.some((c) => /(importo|dare|avere|entrate|uscite|addebit|accredit)/.test(c));
    if (haData && haSoldi) { idxHeader = i; break; }
  }

  const movimenti = [];

  if (idxHeader >= 0) {
    const intest = dividiRiga(righe[idxHeader], sep).map((c) => c.toLowerCase());
    const iData = cercaIndice(intest, /data/);
    const iImporto = cercaIndice(intest, /importo/);
    const iDare = cercaIndice(intest, /(dare|uscite|addebit)/);
    const iAvere = cercaIndice(intest, /(avere|entrate|accredit)/);
    const iDescr = (() => {
      const j = cercaIndice(intest, /(descrizione|causale)/);
      return j >= 0 ? j : cercaIndice(intest, /operazione/);
    })();

    for (let i = idxHeader + 1; i < righe.length; i++) {
      const celle = dividiRiga(righe[i], sep);
      if (celle.length < 2) continue;
      const data = iData >= 0 ? parseDataFlessibile(celle[iData]) : null;
      let importo = 0;
      if (iImporto >= 0 && celle[iImporto]) {
        const neg = /-/.test(celle[iImporto]);
        importo = (neg ? -1 : 1) * Math.abs(parseImporto(celle[iImporto]));
      } else {
        const dare = iDare >= 0 ? Math.abs(parseImporto(celle[iDare])) : 0;
        const avere = iAvere >= 0 ? Math.abs(parseImporto(celle[iAvere])) : 0;
        importo = avere - dare;
      }
      if (!importo) continue;
      const descrizione = iDescr >= 0 ? celle[iDescr] : celle.filter((_, k) => k !== iData).join(' ').trim();
      movimenti.push({ data, importo, descrizione });
    }
  } else {
    // Nessuna intestazione riconosciuta: indoviniamo colonne riga per riga.
    for (const l of righe) {
      const celle = dividiRiga(l, sep);
      if (celle.length < 2) continue;
      const iData = celle.findIndex((c) => parseDataFlessibile(c));
      const iNum = celle.findIndex((c, k) => k !== iData && pareImporto(c) && /[.,]/.test(c));
      if (iData < 0 || iNum < 0) continue;
      const neg = /-/.test(celle[iNum]);
      const importo = (neg ? -1 : 1) * Math.abs(parseImporto(celle[iNum]));
      if (!importo) continue;
      const descrizione = celle.filter((_, k) => k !== iData && k !== iNum).join(' ').trim();
      movimenti.push({ data: parseDataFlessibile(celle[iData]), importo, descrizione });
    }
  }

  if (movimenti.length === 0) {
    return { movimenti: [], avviso: 'Non ho riconosciuto movimenti in questo file. Controlla di aver esportato il CSV/estratto conto della banca.' };
  }
  return { movimenti, avviso: '' };
}

// Abbina i movimenti alle righe aperte. Un'uscita (importo<0) cerca una fattura
// da pagare; un'entrata (importo>0) una da incassare. Assegnazione "golosa":
// per ogni movimento prende la fattura con importo più vicino e data più vicina,
// senza riusare due volte la stessa fattura.
export function abbinaMovimenti(movimenti, righe) {
  const aperte = righe.filter(
    (r) => r.status === 'done' && !r.pagato && !r.notaCredito && residuo(r) > 0
  );
  const usate = new Set();
  const abbinati = [];
  const nonAbbinati = [];

  for (const mov of movimenti) {
    const tipoCercato = mov.importo < 0 ? 'acquisto' : 'vendita';
    const importoMov = Math.abs(mov.importo);
    let migliore = null;
    let miglioreScarto = Infinity;
    let miglioreDistanza = Infinity;
    for (const r of aperte) {
      if (usate.has(r.id) || r.tipo !== tipoCercato) continue;
      const scarto = Math.abs(residuo(r) - importoMov);
      if (scarto > TOLLERANZA) continue;
      const dr = parseData(r.scadenza) || parseData(r.data);
      const distanza = mov.data && dr ? Math.abs(mov.data - dr) : Infinity;
      if (scarto < miglioreScarto || (scarto === miglioreScarto && distanza < miglioreDistanza)) {
        migliore = r; miglioreScarto = scarto; miglioreDistanza = distanza;
      }
    }
    if (migliore) {
      usate.add(migliore.id);
      abbinati.push({ mov, riga: migliore });
    } else {
      nonAbbinati.push(mov);
    }
  }
  return { abbinati, nonAbbinati };
}
