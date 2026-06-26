import * as XLSX from 'xlsx';
import { Transaction } from '../types';

export function exportMonthToExcel(transactions: Transaction[], month: string) {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const rows = sorted.map(t => ({
    '날짜': t.date,
    '카테고리': t.category,
    '내용': t.content,
    '금액': t.amount,
    '유형': t.type,
    '결제수단': t.paymentMethod,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 30 },
    { wch: 12 }, { wch: 8 }, { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = month.replace('-', '년 ') + '월';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `지출내역_${month}.xlsx`);
}
