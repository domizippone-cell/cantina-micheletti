// Backup completo in un unico file, per portare i dati su un altro
// dispositivo (es. dal telefono al PC) o tenerne una copia di sicurezza.
// Contiene: righe della tabella, memoria fornitori e documenti originali.
// Senza un backend il trasferimento è manuale: si esporta il file da un
// dispositivo e lo si importa sull'altro (WhatsApp, email, chiavetta…).

import { tuttiDocumenti, salvaRecord, svuotaDocumenti } from './db.js';

const FORNITORI_STORAGE = 'estrattore.fornitori';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FILE_READ'));
    reader.readAsDataURL(blob);
  });
}

// "Impronta" di una fattura indipendente dall'id: serve a riconoscere lo
// stesso documento caricato su due dispositivi diversi (quindi con id
// diverso) ed evitare che l'import lo aggiunga una seconda volta.
function impronta(r) {
  const chi = /^\d{11}$/.test(r.partita_iva || '')
    ? 'piva:' + r.partita_iva
    : String(r.controparte || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return [
    r.tipo,
    chi,
    r.data || '',
    (Number(r.imponibile) || 0).toFixed(2),
    (Number(r.iva) || 0).toFixed(2),
    (Number(r.totale) || 0).toFixed(2),
  ].join('|');
}

export async function esportaBackup(rows) {
  let documenti = [];
  try {
    const records = await tuttiDocumenti();
    documenti = await Promise.all(
      records.map(async (r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        dataUrl: await blobToDataUrl(r.blob),
      }))
    );
  } catch {
    // Archivio non disponibile: il backup vale comunque per righe e memoria.
  }

  let fornitori = {};
  try {
    fornitori = JSON.parse(localStorage.getItem(FORNITORI_STORAGE) || '{}');
  } catch {
    fornitori = {};
  }

  const backup = {
    app: 'cantina-micheletti',
    versione: 1,
    esportato: new Date().toISOString(),
    righe: rows,
    fornitori,
    documenti,
  };

  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_cantina_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Legge e controlla un file di backup, senza ancora toccare i dati locali.
// Restituisce l'oggetto backup; lancia un errore se il file non è valido.
export async function leggiBackup(file) {
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('BACKUP_ILLEGGIBILE');
  }
  if (backup?.app !== 'cantina-micheletti' || !Array.isArray(backup.righe)) {
    throw new Error('BACKUP_NON_VALIDO');
  }
  backup.documenti = Array.isArray(backup.documenti) ? backup.documenti : [];
  backup.fornitori = backup.fornitori && typeof backup.fornitori === 'object' ? backup.fornitori : {};
  return backup;
}

// Scrive nell'archivio i documenti originali del backup. Se `soloIds` è dato,
// ripristina solo quelli con id in quell'insieme; altrimenti tutti.
async function ripristinaDocumenti(documenti, soloIds) {
  for (const doc of documenti) {
    if (!doc?.id || !doc.dataUrl) continue;
    if (soloIds && !soloIds.has(doc.id)) continue;
    try {
      const blob = await (await fetch(doc.dataUrl)).blob();
      await salvaRecord(doc.id, { blob, name: doc.name || '', type: doc.type || blob.type });
    } catch {
      /* un documento illeggibile non blocca gli altri */
    }
  }
}

// SOSTITUISCI: questo dispositivo diventa una copia esatta del backup.
// Cancella righe, documenti e memoria fornitori attuali e li riscrive.
export async function sostituisciConBackup(backup) {
  try {
    await svuotaDocumenti();
  } catch {
    /* archivio non disponibile: non blocca il resto */
  }
  await ripristinaDocumenti(backup.documenti, null);
  try {
    localStorage.setItem(FORNITORI_STORAGE, JSON.stringify(backup.fornitori));
  } catch {
    /* memoria non disponibile */
  }
  return { righe: backup.righe, aggiunte: backup.righe.length };
}

// AGGIUNGI: unisce il backup ai dati già presenti senza toccarli.
// Salta le righe già qui, riconosciute per id oppure per contenuto (stessa
// fattura caricata su un altro dispositivo, quindi con id diverso).
export async function aggiungiDaBackup(backup, righeAttuali) {
  const idEsistenti = new Set(righeAttuali.map((r) => r.id));
  const impronteEsistenti = new Set(righeAttuali.map(impronta));

  const nuove = [];
  const improntePrese = new Set();
  for (const r of backup.righe) {
    if (!r || !r.id) continue;
    const f = impronta(r);
    if (idEsistenti.has(r.id) || impronteEsistenti.has(f) || improntePrese.has(f)) continue;
    improntePrese.add(f);
    nuove.push(r);
  }

  // La memoria del backup si aggiunge senza sovrascrivere quella locale.
  try {
    const locali = JSON.parse(localStorage.getItem(FORNITORI_STORAGE) || '{}');
    localStorage.setItem(FORNITORI_STORAGE, JSON.stringify({ ...backup.fornitori, ...locali }));
  } catch {
    /* memoria non disponibile: non blocca l'import */
  }

  // Porta nell'archivio solo i documenti delle righe davvero nuove.
  await ripristinaDocumenti(backup.documenti, new Set(nuove.map((r) => r.id)));

  return {
    righe: nuove,
    aggiunte: nuove.length,
    giaPresenti: backup.righe.length - nuove.length,
  };
}
