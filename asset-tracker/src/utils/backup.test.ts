import { DEFAULT_KINDS } from '../types';
import { BACKUP_VERSION, buildBackup, parseBackup, serializeBackup } from './backup';

describe('backup — 버전 호환', () => {
  it('snapshots 가 없는 버전 1 파일도 그대로 읽힌다', () => {
    const v1 = JSON.stringify({
      format: 'asset-tracker-backup', version: 1, exportedAt: 0,
      kinds: DEFAULT_KINDS, assets: [], loans: [], recurrings: [], goals: [],
    });
    const parsed = parseBackup(v1);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.version).toBe(1);
      expect(parsed.backup.snapshots).toEqual([]);
      expect(parsed.backup.kinds).toHaveLength(DEFAULT_KINDS.length);
    }
  });

  it('내보낸 파일은 최신 버전이고 snapshots 를 담아 되읽힌다', () => {
    const snap = {
      id: 'snap_2026-08', month: '2026-08', takenAt: 1, updatedAt: 1,
      netWorth: 10, totalAsset: 10, totalDebt: 0, liquid: 10, byKind: { k_cash: 10 },
    };
    const text = serializeBackup(buildBackup({
      kinds: DEFAULT_KINDS, assets: [], loans: [], recurrings: [], goals: [],
      snapshots: [snap], now: 5,
    }));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.version).toBe(BACKUP_VERSION);
      expect(parsed.backup.snapshots).toEqual([snap]);
    }
  });

  it('더 최신 버전 파일은 거절한다', () => {
    const text = JSON.stringify({ format: 'asset-tracker-backup', version: BACKUP_VERSION + 1, kinds: DEFAULT_KINDS });
    expect(parseBackup(text).ok).toBe(false);
  });

  it('id 없는 레코드는 걸러낸다', () => {
    const text = JSON.stringify({
      format: 'asset-tracker-backup', version: 2,
      snapshots: [{ month: '2026-01' }, { id: 'snap_2026-02', month: '2026-02' }],
    });
    const parsed = parseBackup(text);
    expect(parsed.ok && parsed.backup.snapshots.map(s => s.id)).toEqual(['snap_2026-02']);
  });
});
