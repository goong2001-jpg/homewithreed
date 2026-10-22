import { emptyState } from '../storage';
import { AppState } from '../types';
import { BACKUP_FORMAT, buildBackup, parseBackup } from './backup';

const withPush = (over: Partial<AppState['push']>): AppState => {
  const s = emptyState();
  return { ...s, push: { ...s.push, ...over } };
};

describe('buildBackup', () => {
  it('기본 내보내기에는 암호와 기기 구독 정보가 들어가지 않는다', () => {
    const b = buildBackup(withPush({ passphrase: 'secret', endpoint: 'https://x', syncedHash: 'h' }), 1);
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.state.push.passphrase).toBe('');
    expect(b.state.push.endpoint).toBe('');
    expect(b.state.push.syncedHash).toBe('');
  });

  it('원하면 암호를 담을 수 있다', () => {
    const b = buildBackup(withPush({ passphrase: 'secret' }), 1, true);
    expect(b.state.push.passphrase).toBe('secret');
  });
});

describe('parseBackup', () => {
  it('암호가 빈 백업은 이 기기의 암호를 지우지 않는다', () => {
    const current = withPush({ passphrase: 'mine', endpoint: 'https://here' });
    const text = JSON.stringify(buildBackup(withPush({ passphrase: 'theirs' }), 1));
    const r = parseBackup(text, current);
    expect(r.ok).toBe(true);
    expect(r.state?.push.passphrase).toBe('mine');
    expect(r.state?.push.endpoint).toBe('https://here');
  });

  it('암호가 든 백업은 그 암호를 가져온다', () => {
    const current = withPush({ passphrase: 'mine' });
    const text = JSON.stringify(buildBackup(withPush({ passphrase: 'theirs' }), 1, true));
    expect(parseBackup(text, current).state?.push.passphrase).toBe('theirs');
  });

  it('다른 앱의 파일은 거절한다', () => {
    expect(parseBackup('{"format":"other","state":{}}', emptyState()).ok).toBe(false);
    expect(parseBackup('not json', emptyState()).ok).toBe(false);
  });
});
