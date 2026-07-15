// Backup completo in un unico file, per portare i dati su un altro
// dispositivo (es. dal telefono al PC) o tenerne una copia di sicurezza.
// Contiene: righe della tabella, memoria fornitori e documenti originali.
// Senza un backend il trasferimento è manuale: si esporta il file da un
// dispositivo e lo si importa sull'altro (WhatsApp, email, chiavetta…).

import { tuttiDocumenti, salvaRecord } from './db.js';

const FORNITORI_STORAGE = 'estrattore.fornitori';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FILE_READ'));
    reader.readAsDataURL(blob);
  });
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

// Importa un file di backup e restituisce { righe, aggiunte, giaPresenti }.
// Le righe già presenti su questo dispositivo (stesso id) restano com'erano,
// così le correzioni fatte qui non vengono sovrascritte.
export async function importaBackup(file, righeAttuali) {
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('BACKUP_ILLEGGIBILE');
  }
  if (backup?.app !== 'cantina-micheletti' || !Array.isArray(backup.righe)) {
    throw new Error('BACKUP_NON_VALIDO');
  }

  // Memoria fornitori: le voci del backup si aggiungono senza cancellare le locali.
  if (backup.fornitori && typeof backup.fornitori === 'object') {
    try {
      const locali = JSON.parse(localStorage.getItem(FORNITORI_STORAGE) || '{}');
      localStorage.setItem(
        FORNITORI_STORAGE,
        JSON.stringify({ ...backup.fornitori, ...locali })
      );
    } catch {
      /* memoria non disponibile: non blocca l'import */
    }
  }

  const esistenti = new Set(righeAttuali.map((r) => r.id));
  const nuove = backup.righe.filter((r) => r && r.id && !esistenti.has(r.id));

  // Documenti originali delle righe nuove: dentro l'archivio di questo dispositivo.
  for (const doc of backup.documenti || []) {
    if (!doc?.id || !doc.dataUrl || esistenti.has(doc.id)) continue;
    try {
      const blob = await (await fetch(doc.dataUrl)).blob();
      await salvaRecord(doc.id, { blob, name: doc.name || '', type: doc.type || blob.type });
    } catch {
      /* un documento illeggibile non blocca gli altri */
    }
  }

  return {
    righe: nuove,
    aggiunte: nuove.length,
    giaPresenti: backup.righe.length - nuove.length,
  };
}
