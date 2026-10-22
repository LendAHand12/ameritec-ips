import ExcelJS from 'exceljs'

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const COLUMN_FORMAT = {
  datetime: 'dd/mm/yyyy hh:mm',
  money: '#,##0.00',
  integer: '#,##0',
  percent: '0.##',
}

/** Vietnamese labels for values that are stored as codes. */
export const VI = {
  yesNo: (v) => (v ? 'Có' : 'Không'),
  kycStatus: { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' },
  accountStatus: { active: 'Hoạt động', locked: 'Đã khóa' },
  faceStatus: { none: 'Chưa quét', pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' },
  orderStatus: {
    awaiting_payment: 'Chờ thanh toán',
    paying: 'Đang thanh toán',
    verifying: 'Đang xác minh',
    pending_review: 'Chờ admin duyệt',
    completed: 'Hoàn tất',
    rejected: 'Bị từ chối',
    cancelled: 'Đã hủy',
  },
  paymentMethod: { bep20: 'USDT (BEP20)', zelle: 'Zelle', other: 'Khác' },
  commissionStatus: { pending: 'Đang chờ (chưa được rút)', available: 'Có thể rút' },
}

/**
 * Sends an .xlsx file: one sheet, a bold frozen header row, filters, and per-column formats.
 * columns: [{ header, key, width, format? }] — dates must be Date objects, money plain numbers.
 */
export async function sendExcel(res, { filename, sheet, columns, rows }) {
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()
  const ws = workbook.addWorksheet(sheet, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18, style: c.format ? { numFmt: COLUMN_FORMAT[c.format] ?? c.format } : {} }))
  ws.addRows(rows)

  const header = ws.getRow(1)
  header.height = 24
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.alignment = { vertical: 'middle', wrapText: true }
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE61E32' } }
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }

  res.set('Content-Type', XLSX_MIME)
  res.set('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(res)
  res.end()
}

export const stamp = () => new Date().toISOString().slice(0, 10)
