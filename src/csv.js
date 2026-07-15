// Esportazione CSV pensata per Excel italiano:
// separatore ";", decimali con la virgola, BOM UTF-8 per gli accenti.

function num(v) {
  return (Number(v) || 0).toFixed(2).replace('.', ',');
}

function quote(v) {
  const s = String(v ?? '');
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function exportCsv(rows) {
  const header = [
    'Tipo',
    'Cliente/Fornitore',
    'Data',
    'Scadenza',
    'Partita IVA',
    'Categoria',
    'Imponibile',
    'IVA',
    'Totale',
    'Pagata',
    'File',
  ];
  const lines = rows.map((r) =>
    [
      r.tipo === 'vendita' ? 'Vendita' : 'Acquisto',
      r.controparte,
      r.data,
      r.scadenza,
      r.partita_iva,
      r.categoria,
      num(r.imponibile),
      num(r.iva),
      num(r.totale),
      r.pagato ? 'Sì' : 'No',
      r.fileName,
    ]
      .map(quote)
      .join(';')
  );
  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `documenti_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
