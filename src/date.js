// Le date nei documenti viaggiano come testo "GG/MM/AAAA": qui ci sono le
// funzioni per interpretarle, condivise da scadenzario, riepilogo e filtri.

// "15/07/2026" → Date (mezzanotte locale), oppure null se non è una data valida.
export function parseData(str) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(str || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]) ? d : null;
}

// "15/07/2026" → "2026-07" (comoda per raggruppare e ordinare), oppure null.
export function chiaveMese(str) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(str || '').trim());
  return m ? m[3] + '-' + m[2].padStart(2, '0') : null;
}

export const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

// "2026-07" → "Luglio 2026".
export function etichettaMese(chiave) {
  const [anno, mese] = String(chiave).split('-');
  return (MESI[Number(mese) - 1] || mese) + ' ' + anno;
}

// "15/07/2026" → "2026-T3" (trimestre), oppure null.
export function chiaveTrimestre(str) {
  const k = chiaveMese(str);
  if (!k) return null;
  const [anno, mese] = k.split('-');
  const trim = Math.floor((Number(mese) - 1) / 3) + 1;
  return anno + '-T' + trim;
}

// "2026-T3" → "3° trimestre 2026".
export function etichettaTrimestre(chiave) {
  const [anno, t] = String(chiave).split('-T');
  return t + '° trimestre ' + anno;
}

// "2026-T3" → { da: Date, a: Date } con i due estremi del trimestre.
export function estremiTrimestre(chiave) {
  const [anno, t] = String(chiave).split('-T');
  const primoMese = (Number(t) - 1) * 3; // 0, 3, 6, 9
  const da = new Date(Number(anno), primoMese, 1);
  const a = new Date(Number(anno), primoMese + 3, 0); // ultimo giorno del trimestre
  return { da, a };
}

// "AAAA-MM-GG" (dagli input <input type="date">) → Date a mezzanotte locale, o null.
export function parseISO(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Giorni interi da oggi alla data (negativi se è già passata).
export function giorniDaOggi(date) {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  return Math.round((date - oggi) / 86_400_000);
}
