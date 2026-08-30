import { AppState } from '../types';
import { emptyState } from '../storage';

/**
 * 백업 파일.
 *
 * ⚠️ 이 앱은 서버에 아무것도 저장하지 않는다. localStorage 가 유일한 사본이라
 *    브라우저 데이터를 지우거나 폰을 바꾸면 대화도 기록도 그대로 사라진다.
 *
 * 아이폰에서는 이게 특히 중요하다 — 사파리에서 설정한 내용은 홈 화면 앱으로
 * 넘어가지 않기 때문에, 내보내기·불러오기가 설정을 옮기는 정식 통로가 된다.
 */
export const BACKUP_FORMAT = 'habit-talk-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: string;
  version: number;
  exportedAt: number;
  state: AppState;
}

export function buildBackup(state: AppState, now = Date.now()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    // 기기 구독 정보는 기기마다 달라야 하니 빼고 내보낸다
    state: { ...state, push: { ...state.push, endpoint: '', syncedHash: '' } },
  };
}

export function backupFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `톡톡습관친구-백업-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
}

export interface ParseResult {
  ok: boolean;
  state?: AppState;
  reason?: string;
}

export function parseBackup(text: string, current: AppState): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: '백업 파일을 읽을 수 없어요. 파일이 손상된 것 같아요.' };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: '백업 파일 형식이 아니에요.' };
  }
  const b = raw as Partial<Backup>;
  if (b.format !== BACKUP_FORMAT || !b.state) {
    return { ok: false, reason: '이 앱의 백업 파일이 아니에요.' };
  }

  const base = emptyState();
  const s = b.state;
  return {
    ok: true,
    state: {
      ...base,
      profile: { ...base.profile, ...(s.profile ?? {}) },
      friends: Array.isArray(s.friends) && s.friends.length > 0 ? s.friends : base.friends,
      slots: Array.isArray(s.slots) && s.slots.length > 0 ? s.slots : base.slots,
      messages: Array.isArray(s.messages) ? s.messages : [],
      logs: Array.isArray(s.logs) ? s.logs : [],
      lastRead: s.lastRead ?? {},
      delivered: Array.isArray(s.delivered) ? s.delivered : [],
      // 구독은 이 기기 것을 그대로 유지한다
      push: { ...current.push, passphrase: s.push?.passphrase || current.push.passphrase },
    },
  };
}

export function downloadBackup(state: AppState): void {
  const blob = new Blob([JSON.stringify(buildBackup(state))], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
