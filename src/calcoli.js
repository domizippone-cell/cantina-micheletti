// ============================================================================
//  Logica di calcolo condivisa: totali, controlli, aggregazioni.
//  Sta qui (e non dentro i componenti) così tabella, filtri, dashboard,
//  riepilogo e grafici ragionano tutti allo stesso modo, senza duplicati.
// ============================================================================

import { chiaveMese, chiaveTrimestre } from './date.js';

// Interpreta un importo scritto a mano: accetta sia "1.234,56" (formato
// italiano) sia "1234.56". Restituisce un numero (0 se vuoto/illeggibile).
export function parseImporto(str) {
  const s = String(str).replace(/[€\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(s) || 0;
}

// Le note di credito (storni) vanno SOTTRATTE dai totali: qui il loro segno è −1.
export function segno(row) {
  return row?.notaCredito ? -1 : 1;
}

// Importo "con segno": positivo per un documento normale, negativo per una
// nota di credito. Usalo ovunque si sommino imponibile/iva/totale.
export function netto(row, campo = 'totale') {
  return (Number(row?.[campo]) || 0) * segno(row);
}

// Quanto manca da pagare/incassare su una riga: totale − acconto già versato
// (mai negativo). Per le note di credito resta 0 (non sono un pagamento dovuto).
export function residuo(row) {
  if (row?.notaCredito) return 0;
  const tot = Number(row?.totale) || 0;
  const acc = Number(row?.acconto) || 0;
  return Math.max(0, tot - acc);
}

// Se imponibile + IVA non fa il totale, restituisce la somma calcolata
// (con una piccola tolleranza per gli arrotondamenti), altrimenti null.
export function sommaNonQuadra(row) {
  if (row.status !== 'done') return null;
  const imp = Number(row.imponibile) || 0;
  const iva = Number(row.iva) || 0;
  const tot = Number(row.totale) || 0;
  if (!imp && !iva && !tot) return null;
  const somma = imp + iva;
  return Math.abs(somma - tot) > 0.05 ? somma : null;
}

// Due documenti con stessa controparte, stessa data e stesso totale sono
// quasi certamente lo stesso foglio caricato due volte: la mappa restituita
// associa l'id di ogni copia al nome del file caricato per primo.
export function trovaDoppioni(rows) {
  const primi = new Map();
  const doppioni = new Map();
  for (const r of rows) {
    if (r.status !== 'done') continue;
    const chi = /^\d{11}$/.test(r.partita_iva || '')
      ? 'piva:' + r.partita_iva
      : String(r.controparte || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const totale = Number(r.totale) || 0;
    if (!chi || !totale || !r.data) continue;
    const chiave = chi + '|' + r.data + '|' + totale.toFixed(2);
    if (primi.has(chiave)) doppioni.set(r.id, primi.get(chiave).fileName);
    else primi.set(chiave, r);
  }
  return doppioni;
}

// Insieme degli id delle righe "da controllare": errore di estrazione,
// conti che non tornano oppure possibile doppione.
export function insiemeProblemi(rows) {
  const doppioni = trovaDoppioni(rows);
  const ids = new Set(doppioni.keys());
  for (const r of rows) {
    if (r.status === 'error') ids.add(r.id);
    else if (sommaNonQuadra(r) !== null) ids.add(r.id);
  }
  return ids;
}

export function contaProblemi(rows) {
  return insiemeProblemi(rows).size;
}

// Aggrega le righe "done" per mese: { vendite, acquisti, saldo, conteggio,
// ivaVendite, ivaAcquisti, categorie: Map(cat→importo) }. Le note di credito
// entrano col segno negativo.
export function perMese(rows) {
  const gruppi = new Map();
  for (const r of rows) {
    if (r.status !== 'done') continue;
    const k = chiaveMese(r.data) || 'senza-data';
    if (!gruppi.has(k)) {
      gruppi.set(k, {
        vendite: 0, acquisti: 0, conteggio: 0,
        ivaVendite: 0, ivaAcquisti: 0, categorie: new Map(),
      });
    }
    const g = gruppi.get(k);
    const tot = netto(r, 'totale');
    const iva = netto(r, 'iva');
    if (r.tipo === 'vendita') { g.vendite += tot; g.ivaVendite += iva; }
    else { g.acquisti += tot; g.ivaAcquisti += iva; }
    g.conteggio += 1;
    const cat = r.categoria || 'Altro';
    g.categorie.set(cat, (g.categorie.get(cat) || 0) + tot);
  }
  return gruppi;
}

// Stima IVA per trimestre: IVA sulle vendite (a debito) − IVA sugli acquisti
// (a credito). Ordinati dal più recente. Restituisce un array di oggetti.
export function ivaPerTrimestre(rows) {
  const gruppi = new Map();
  for (const r of rows) {
    if (r.status !== 'done') continue;
    const k = chiaveTrimestre(r.data);
    if (!k) continue;
    if (!gruppi.has(k)) gruppi.set(k, { chiave: k, ivaVendite: 0, ivaAcquisti: 0 });
    const g = gruppi.get(k);
    const iva = netto(r, 'iva');
    if (r.tipo === 'vendita') g.ivaVendite += iva;
    else g.ivaAcquisti += iva;
  }
  return [...gruppi.values()]
    .map((g) => ({ ...g, saldo: g.ivaVendite - g.ivaAcquisti }))
    .sort((a, b) => b.chiave.localeCompare(a.chiave));
}

// Classifica delle controparti per un dato tipo ("acquisto"/"vendita"):
// { controparte, totale, conteggio } ordinati per importo decrescente.
export function topControparti(rows, tipo, limite = 8) {
  const gruppi = new Map();
  for (const r of rows) {
    if (r.status !== 'done' || r.tipo !== tipo) continue;
    const nome = String(r.controparte || '').trim() || '(senza nome)';
    const chiave = /^\d{11}$/.test(r.partita_iva || '') ? 'piva:' + r.partita_iva : 'nome:' + nome.toLowerCase();
    if (!gruppi.has(chiave)) gruppi.set(chiave, { controparte: nome, totale: 0, conteggio: 0 });
    const g = gruppi.get(chiave);
    g.totale += netto(r, 'totale');
    g.conteggio += 1;
  }
  return [...gruppi.values()].sort((a, b) => b.totale - a.totale).slice(0, limite);
}

// Ripartizione della spesa/incasso per categoria su un insieme di righe già
// filtrato: [{ categoria, totale }] ordinato per importo decrescente.
export function perCategoria(rows, tipo = null) {
  const m = new Map();
  for (const r of rows) {
    if (r.status !== 'done') continue;
    if (tipo && r.tipo !== tipo) continue;
    const cat = r.categoria || 'Altro';
    m.set(cat, (m.get(cat) || 0) + netto(r, 'totale'));
  }
  return [...m.entries()]
    .map(([categoria, totale]) => ({ categoria, totale }))
    .filter((x) => x.totale !== 0)
    .sort((a, b) => Math.abs(b.totale) - Math.abs(a.totale));
}

// Bollette ricorrenti che sembrano MANCARE nel mese corrente: fornitori di
// categoria "Utenze" comparsi in almeno 2 mesi diversi tra gli ultimi mesi, ma
// non ancora in questo mese. Restituisce [{ controparte, ultimoMese }].
export function bolletteMancanti(rows, oggi = new Date()) {
  const meseCorrente =
    oggi.getFullYear() + '-' + String(oggi.getMonth() + 1).padStart(2, '0');
  const perFornitore = new Map();
  for (const r of rows) {
    if (r.status !== 'done' || r.tipo !== 'acquisto' || r.categoria !== 'Utenze') continue;
    const k = chiaveMese(r.data);
    const nome = String(r.controparte || '').trim();
    if (!k || !nome) continue;
    const chiave = nome.toLowerCase();
    if (!perFornitore.has(chiave)) perFornitore.set(chiave, { nome, mesi: new Set() });
    perFornitore.get(chiave).mesi.add(k);
  }
  const mancanti = [];
  for (const { nome, mesi } of perFornitore.values()) {
    if (mesi.size < 2) continue; // serve una minima abitudine, non un caso isolato
    if (mesi.has(meseCorrente)) continue; // già arrivata questo mese
    const ultimoMese = [...mesi].sort().pop();
    // Solo se l'ultima è recente (mese scorso), altrimenti è un fornitore chiuso.
    const [ya, ma] = ultimoMese.split('-').map(Number);
    const distanza = (oggi.getFullYear() - ya) * 12 + (oggi.getMonth() + 1 - ma);
    if (distanza <= 2) mancanti.push({ controparte: nome, ultimoMese });
  }
  return mancanti;
}
