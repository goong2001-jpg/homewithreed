import { Transaction } from '../types';

/**
 * xlsx는 400KB가 넘는다. 내보내기는 어쩌다 한 번 쓰는 기능이므로
 * 정적 import를 하지 않고 누를 때만 받아온다.
 */
export async function exportMonthToExcel(transactions: Transaction[], month: string): Promise<void> {
  const XLSX = await import('xlsx');
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
