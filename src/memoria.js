// "Memoria fornitori": quando l'utente corregge a mano una riga, l'app
// ricorda controparte → categoria/P.IVA e riapplica la correzione ai
// documenti futuri della stessa controparte, così c'è sempre meno da sistemare.

const STORAGE = 'estrattore.fornitori';

function carica() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || '{}');
  } catch {
    return {};
  }
}

// Una voce è raggiungibile sia dalla P.IVA (più affidabile) sia dal nome.
function chiavi(controparte, partita_iva) {
  const out = [];
  if (/^\d{11}$/.test(partita_iva || '')) out.push('piva:' + partita_iva);
  const nome = String(controparte || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (nome) out.push('nome:' + nome);
  return out;
}

// Da chiamare quando l'utente corregge una riga a mano.
export function ricordaControparte(row) {
  const ks = chiavi(row.controparte, row.partita_iva);
  if (ks.length === 0) return;
  const memoria = carica();
  const voce = {
    controparte: row.controparte,
    partita_iva: row.partita_iva,
    categoria: row.categoria,
  };
  for (const k of ks) memoria[k] = voce;
  localStorage.setItem(STORAGE, JSON.stringify(memoria));
}

// Da chiamare sui campi appena estratti da Gemini: applica le correzioni ricordate.
export function applicaMemoria(fields) {
  const memoria = carica();
  const voce = chiavi(fields.controparte, fields.partita_iva)
    .map((k) => memoria[k])
    .find(Boolean);
  if (!voce) return fields;
  return {
    ...fields,
    controparte: voce.controparte || fields.controparte,
    partita_iva: fields.partita_iva || voce.partita_iva || '',
    categoria: voce.categoria || fields.categoria,
  };
}
