import { BlockPlan, Category, Entry, Resist, TimeBlock } from '../types';

/**
 * 백업 파일 형식.
 *
 * ⚠️ 이 앱은 클라우드 동기화가 없다. localStorage가 시간 기록의 유일한 사본이라
 *    브라우저 데이터를 지우거나 폰을 바꾸면 그대로 사라진다.
 *    이 파일이 사실상 유일한 방어선이므로 설정 화면 맨 위에 둔다.
 *
 * 불러오기는 utils/merge.ts 의 mergeById 를 쓴다 —
 * 항목마다 id와 updatedAt이 있고 삭제도 툼스톤으로 남아서,
 * 백업을 얹어도 지운 기록이 엉뚱하게 되살아나지 않는다.
 */
export const BACKUP_FORMAT = 'time-tracker-backup';
/** 2: 타임블록·블록 계획·참은 기록이 추가됐다. 1로 만든 파일도 그대로 읽는다 */
export const BACKUP_VERSION = 2;

export interface Backup {
  format: string;
  version: number;
  exportedAt: number;
  categories: Category[];
  entries: Entry[];
  blocks: TimeBlock[];
  plans: BlockPlan[];
  resists: Resist[];
}

export function buildBackup(input: {
  categories: Category[];
  entries: Entry[];
  blocks: TimeBlock[];
  plans: BlockPlan[];
  resists: Resist[];
  now?: number;
}): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: input.now ?? Date.now(),
    // 삭제 표시(툼스톤)도 같이 담는다 — 빼면 복원할 때 지운 기록이 되살아난다
    categories: input.categories,
    entries: input.entries,
    blocks: input.blocks,
    plans: input.plans,
    resists: input.resists,
  };
}

export function serializeBackup(b: Backup): string {
  return JSON.stringify(b);
}

/** 최소한의 확인만 한다 — id가 있어야 합칠 수 있다 */
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
    return { ok: false, error: '시간기록 백업 파일이 아닌 것 같아요. [백업 내보내기]로 만든 파일인지 확인해 주세요.' };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '시간기록 백업 파일이 아닌 것 같아요.' };
  }
  const o = raw as Record<string, unknown>;

  if (o.format !== BACKUP_FORMAT) {
    return { ok: false, error: '이 앱에서 만든 파일이 아니에요. 시간기록 앱의 [백업 내보내기]로 만든 파일을 골라주세요.' };
  }
  if (typeof o.version === 'number' && o.version > BACKUP_VERSION) {
    return { ok: false, error: '더 최신 버전에서 만든 파일이에요. 앱을 새로고침한 뒤 다시 시도해 주세요.' };
  }

  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: typeof o.version === 'number' ? o.version : 1,
    exportedAt: typeof o.exportedAt === 'number' ? o.exportedAt : 0,
    categories: readRecords<Category>(o.categories),
    entries: readRecords<Entry>(o.entries),
    // 버전 1로 만든 파일에는 아예 없는 키들 — 없으면 빈 배열이 된다
    blocks: readRecords<TimeBlock>(o.blocks),
    plans: readRecords<BlockPlan>(o.plans),
    resists: readRecords<Resist>(o.resists),
  };

  if (backup.categories.length + backup.entries.length === 0) {
    return { ok: false, error: '파일에 기록이 하나도 없어요.' };
  }

  return { ok: true, backup };
}

export function backupFileName(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `시간기록백업_${y}${m}${d}.json`;
}

/** '기록 128건 · 분류 10개 · 블록 계획 21개' */
export function backupSummary(b: Backup): string {
  const n = <T extends { deleted?: boolean }>(rs: T[]) => rs.filter(r => !r.deleted).length;
  const parts = [`기록 ${n(b.entries)}건`, `분류 ${n(b.categories)}개`];
  if (n(b.plans)) parts.push(`블록 계획 ${n(b.plans)}개`);
  return parts.join(' · ');
}

/** 브라우저에서 파일로 내려받는다 */
export function downloadBackup(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 즉시 지우면 사파리에서 저장이 취소되는 일이 있어 잠깐 뒤에 정리한다
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
