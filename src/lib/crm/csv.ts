// CSV per Excel italiano: separatore ";", BOM UTF-8, CRLF.
export function csvCell(v: unknown) {
  if (v == null) return "";
  let s = String(v);
  // evita formula injection in Excel (ma lascia intatti numeri e telefoni come "+39 02 ...")
  // (anche con spazi iniziali, che alcuni fogli di calcolo ignorano)
  if (/^[\s]*[=+\-@\t\r]/.test(s) && !/^\s*[+-]?[\d\s().\/-]+$/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
