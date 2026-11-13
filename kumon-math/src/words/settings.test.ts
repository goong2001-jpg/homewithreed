import { exportBackup, importBackup, loadSettings, saveSettings, DEFAULT_SETTINGS } from './settings';

beforeEach(() => { localStorage.clear(); });

describe('설정', () => {
  it('저장한 값에 없는 항목은 기본값으로 채운다', () => {
    localStorage.setItem('word_settings', JSON.stringify({ childName: '구름' }));
    expect(loadSettings()).toMatchObject({ childName: '구름', approveUse: true });
    expect(loadSettings().bigRewards).toEqual(DEFAULT_SETTINGS.bigRewards);
  });
});

describe('기록 백업', () => {
  it('내보낸 글자로 다른 기기에서 그대로 되살린다', () => {
    localStorage.setItem('word_progress', JSON.stringify({ totalLearned: 42, coupons: { tv: 3 } }));
    localStorage.setItem('kumon_game_state', JSON.stringify({ points: 77 }));
    saveSettings({ ...DEFAULT_SETTINGS, childName: '구름' });
    localStorage.setItem('unrelated', 'x');
    const text = exportBackup();

    localStorage.clear();
    expect(importBackup(text)).toBeNull();
    expect(JSON.parse(localStorage.getItem('word_progress')!).totalLearned).toBe(42);
    expect(JSON.parse(localStorage.getItem('kumon_game_state')!).points).toBe(77);
    expect(loadSettings().childName).toBe('구름');
    expect(localStorage.getItem('unrelated')).toBeNull();
  });

  it('잘못된 글자는 받지 않고 지금 기록을 건드리지 않는다', () => {
    localStorage.setItem('word_progress', JSON.stringify({ totalLearned: 5 }));
    expect(importBackup('안녕')).toMatch(/읽을 수 없어요/);
    expect(importBackup(JSON.stringify({ app: 'other', data: {} }))).toMatch(/백업이 아니에요/);
    expect(importBackup(JSON.stringify({ app: 'homewithreed-words', data: { kumon_items: '[]' } }))).toMatch(/단어 기록/);
    expect(importBackup(JSON.stringify({ app: 'homewithreed-words', data: { word_progress: '{깨짐' } }))).toMatch(/깨져/);
    expect(JSON.parse(localStorage.getItem('word_progress')!).totalLearned).toBe(5);
  });

  it('백업에 없는 낯선 칸은 쓰지 않는다', () => {
    const text = JSON.stringify({ app: 'homewithreed-words', data: { word_progress: '{}', evil_key: '"x"' } });
    expect(importBackup(text)).toBeNull();
    expect(localStorage.getItem('evil_key')).toBeNull();
  });
});
