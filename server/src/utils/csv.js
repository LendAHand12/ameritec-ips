// Cells starting with these are executed as formulas by spreadsheet apps (CSV injection)
const FORMULA_START = /^[=+\-@\t\r]/

const cell = (value) => {
  let s = value == null ? '' : String(value)
  if (FORMULA_START.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers, rows) {
  const lines = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))]
  // BOM so Excel opens UTF-8 (Vietnamese names) correctly
  return '﻿' + lines.join('\r\n')
}
