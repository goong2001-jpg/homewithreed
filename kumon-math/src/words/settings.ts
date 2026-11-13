/**
 * 엄마·아빠가 정하는 설정 — 엄마·아빠 메뉴에서 바꾼다.
 */
export interface BigReward {
  emoji: string;
  name: string;
  /** 저금통에서 내는 쿠폰 수 */
  cost: number;
}

export interface Settings {
  /** 쿠폰을 쓸 때 엄마·아빠 확인(곱셈 문제)을 받는지 */
  approveUse: boolean;
  /** 아이 이름 — 칭찬 카드와 상장에 넣는다 (비워 두면 이름 없이) */
  childName: string;
  /** 저금통으로 받을 수 있는 큰 보상 */
  bigRewards: BigReward[];
}

const KEY = 'word_settings';

export const DEFAULT_SETTINGS: Settings = {
  approveUse: true,
  childName: '',
  bigRewards: [
    { emoji: '🎮', name: '로블록스 30분', cost: 8 },
    { emoji: '🎬', name: '영화 한 편 보기', cost: 12 },
    { emoji: '🎡', name: '주말에 놀러 가기', cost: 20 },
  ],
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
      if (!Array.isArray(saved.bigRewards) || !saved.bigRewards.length) saved.bigRewards = DEFAULT_SETTINGS.bigRewards;
      return saved;
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(next: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
}

// ── 기록 백업 ────────────────────────────────────────────────
/** 백업에 담는 저장 칸들 */
export const BACKUP_KEYS = [
  'word_progress', 'word_missions', 'word_streak', 'word_greeted', 'word_log', 'word_confusions',
  'word_settings', 'word_weekly', 'kumon_game_state', 'kumon_items', 'alphabet_progress',
];

const MARK = 'homewithreed-words';

/** 지금 기록을 글자 하나로 묶는다 */
export function exportBackup(): string {
  const data: Record<string, string> = {};
  for (const k of BACKUP_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    } catch {}
  }
  return JSON.stringify({ app: MARK, version: 1, savedAt: new Date().toISOString(), data });
}

/** 백업 글자를 읽어 저장한다. 잘못된 글자면 이유를 돌려준다 (성공하면 null) */
export function importBackup(text: string): string | null {
  let parsed: any;
  try { parsed = JSON.parse(text.trim()); } catch { return '백업 글자를 읽을 수 없어요. 처음부터 끝까지 다 붙여 넣었는지 확인해 주세요.'; }
  if (!parsed || parsed.app !== MARK || typeof parsed.data !== 'object' || !parsed.data) {
    return '이 앱의 백업이 아니에요.';
  }
  const entries = Object.entries(parsed.data as Record<string, unknown>)
    .filter(([k, v]) => BACKUP_KEYS.includes(k) && typeof v === 'string');
  if (!entries.some(([k]) => k === 'word_progress')) return '백업에 단어 기록이 들어 있지 않아요.';
  // 가장 중요한 단어 기록이 읽을 수 있는 값인지 먼저 확인한 뒤에 쓴다
  try {
    const wp = JSON.parse(parsed.data.word_progress);
    if (!wp || typeof wp !== 'object') throw new Error();
  } catch { return '백업이 깨져 있어요.'; }
  try {
    for (const [k, v] of entries) localStorage.setItem(k, v as string);
  } catch { return '저장하지 못했어요. 기기 저장 공간을 확인해 주세요.'; }
  return null;
}
