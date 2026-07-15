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

// Giorni interi da oggi alla data (negativi se è già passata).
export function giorniDaOggi(date) {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  return Math.round((date - oggi) / 86_400_000);
}
