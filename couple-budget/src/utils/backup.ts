import { Expense, FixedExpense, IncomeEntry, Person } from '../types';

/**
 * 부부끼리 파일로 주고받는 백업 형식.
 *
 * Firebase 없이 두 폰의 기록을 합치는 데 쓴다.
 * 서버를 거치지 않으므로 데이터는 두 사람의 폰과 두 사람이 쓰는 메신저에만 남는다.
 *
 * 합치기는 utils/merge.ts 의 mergeById 를 그대로 쓴다 —
 * 항목마다 id 와 updatedAt 이 있고 삭제도 툼스톤으로 남기 때문에,
 * 서로 주고받기만 하면 양쪽이 같은 결과로 수렴한다.
 */
export const BACKUP_FORMAT = 'couple-budget-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: string;
  version: number;
  exportedAt: number;
  persons: Person[];
  incomes: IncomeEntry[];
  fixedExpenses: FixedExpense[];
  expenses: Expense[];
}

export function buildBackup(input: {
  persons: Person[];
  incomes: IncomeEntry[];
  fixedExpenses: FixedExpense[];
  expenses: Expense[];
  now?: number;
}): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: input.now ?? Date.now(),
    persons: input.persons,
    // 삭제 표시(툼스톤)도 같이 보낸다 — 안 보내면 상대 폰에서 지운 항목이 되살아난다
    incomes: input.incomes,
    fixedExpenses: input.fixedExpenses,
    expenses: input.expenses,
  };
}

export function serializeBackup(b: Backup): string {
  return JSON.stringify(b);
}

/** 레코드 배열인지 최소한만 확인한다 (id 가 있어야 합칠 수 있다) */
function readRecords<T>(v: unknown): T[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (r): r is T =>
      !!r && typeof r === 'object' &&
      typeof (r as { id?: unknown }).id === 'string' &&
      (r as { id: string }).id.length > 0,
  );
}

export function parseBackup(
  text: string,
): { ok: true; backup: Backup } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: '파일이 비어 있어요.' };

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: '가계부 파일이 아닌 것 같아요. 상대방이 [내보내기]로 만든 파일인지 확인해 주세요.' };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '가계부 파일이 아닌 것 같아요.' };
  }
  const o = raw as Record<string, unknown>;

  if (o.format !== BACKUP_FORMAT) {
    return { ok: false, error: '이 앱에서 만든 파일이 아니에요. 상대방 앱의 [내보내기]로 만든 파일을 골라주세요.' };
  }
  if (typeof o.version === 'number' && o.version > BACKUP_VERSION) {
    return { ok: false, error: '상대방 앱이 더 최신이에요. 이 폰에서 앱을 새로고침한 뒤 다시 시도해 주세요.' };
  }

  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: typeof o.version === 'number' ? o.version : 1,
    exportedAt: typeof o.exportedAt === 'number' ? o.exportedAt : 0,
    persons: readRecords<Person>(o.persons),
    incomes: readRecords<IncomeEntry>(o.incomes),
    fixedExpenses: readRecords<FixedExpense>(o.fixedExpenses),
    expenses: readRecords<Expense>(o.expenses),
  };

  const total = backup.persons.length + backup.incomes.length
    + backup.fixedExpenses.length + backup.expenses.length;
  if (total === 0) {
    return { ok: false, error: '파일에 기록이 하나도 없어요. 상대방이 먼저 가계부를 입력했는지 확인해 주세요.' };
  }

  return { ok: true, backup };
}

export function backupFileName(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `우리집가계부_${y}${m}${d}.json`;
}

/** '지출 123건 · 수입 4건 · 고정지출 3건' */
export function backupSummary(b: Backup): string {
  const alive = <T extends { deleted?: boolean }>(rs: T[]) => rs.filter(r => !r.deleted).length;
  return [
    `지출 ${alive(b.expenses)}건`,
    `수입 ${alive(b.incomes)}건`,
    `고정지출 ${alive(b.fixedExpenses)}건`,
  ].join(' · ');
}
