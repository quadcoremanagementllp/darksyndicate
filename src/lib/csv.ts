/** Serialize rows for spreadsheet downloads, escaping quotes and formula-like values. */
export function serializeCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map((value) => {
    let cell = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(cell)) cell = `'${cell}`;
    return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
  }).join(',')).join('\r\n');
}
