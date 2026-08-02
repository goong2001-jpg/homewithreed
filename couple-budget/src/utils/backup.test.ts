import {
  BACKUP_FORMAT, backupFileName, backupSummary, buildBackup, mergePersons,
  parseBackup, serializeBackup,
} from './backup';
import { mergeById } from './merge';
import { Expense, FixedExpense, IncomeEntry, Person } from '../types';

const PERSONS: Person[] = [
  { id: 'p1', name: '나', color: '#3498db', order: 0 },
  { id: 'p2', name: '와이프', color: '#e8748f', order: 1 },
];

const income = (id: string, amount: number, updatedAt = 100): IncomeEntry =>
  ({ id, month: '2026-07', personId: 'p1', amount, memo: '급여', createdAt: 0, updatedAt });

const fixedExp = (id: string, amount: number): FixedExpense =>
  ({ id, name: '월세', amount, startMonth: '2026-01', endMonth: null, personId: null, createdAt: 0, updatedAt: 100 });

const expense = (id: string, amount: number, updatedAt = 100, deleted?: boolean): Expense =>
  ({
    id, date: '2026-07-05', month: '2026-07', amount, category: '식비',
    content: '장보기', personId: 'p1', createdAt: 0, updatedAt,
    ...(deleted !== undefined ? { deleted } : {}),
  });

function sample() {
  return buildBackup({
    persons: PERSONS,
    incomes: [income('i1', 3_200_000)],
    fixedExpenses: [fixedExp('f1', 1_000_000)],
    expenses: [expense('e1', 30_000), expense('e2', 50_000)],
    now: 1_700_000_000_000,
  });
}

describe('내보내기 → 가져오기 왕복', () => {
  it('그대로 복원된다', () => {
    const out = parseBackup(serializeBackup(sample()));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.backup.format).toBe(BACKUP_FORMAT);
    expect(out.backup.expenses).toHaveLength(2);
    expect(out.backup.incomes[0].amount).toBe(3_200_000);
    expect(out.backup.fixedExpenses[0].amount).toBe(1_000_000);
    expect(out.backup.exportedAt).toBe(1_700_000_000_000);
  });

  it('삭제 표시도 함께 실려간다', () => {
    // 이게 빠지면 상대 폰에서 지운 항목이 내 파일 때문에 되살아난다
    const b = buildBackup({
      persons: PERSONS, incomes: [], fixedExpenses: [],
      expenses: [expense('e1', 30_000, 200, true)],
    });
    const out = parseBackup(serializeBackup(b));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.backup.expenses[0].deleted).toBe(true);
  });
});

describe('잘못된 파일 방어', () => {
  it('빈 파일', () => {
    const r = parseBackup('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('비어');
  });

  it('JSON이 아닌 파일', () => {
    const r = parseBackup('이건 사진 파일입니다');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('가계부 파일이 아닌');
  });

  it('다른 앱의 JSON', () => {
    const r = parseBackup('{"hello":"world"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('이 앱에서 만든 파일이 아니');
  });

  it('더 최신 버전 파일이면 새로고침을 안내한다', () => {
    const r = parseBackup(JSON.stringify({ ...sample(), version: 99 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('최신');
  });

  it('기록이 하나도 없으면 알려준다', () => {
    const r = parseBackup(JSON.stringify({
      format: BACKUP_FORMAT, version: 1, exportedAt: 0,
      persons: PERSONS, incomes: [], fixedExpenses: [], expenses: [],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('기록이 하나도');
  });

  it('id 없는 쓰레기 레코드는 걸러낸다', () => {
    const r = parseBackup(JSON.stringify({
      format: BACKUP_FORMAT, version: 1, exportedAt: 0, persons: [],
      incomes: [], fixedExpenses: [],
      expenses: [expense('e1', 1000), { amount: 5 }, null, 'abc'],
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.expenses).toHaveLength(1);
  });

  it('배열이 아예 없어도 터지지 않는다', () => {
    const r = parseBackup(JSON.stringify({
      format: BACKUP_FORMAT, version: 1, expenses: [expense('e1', 1000)],
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.incomes).toEqual([]);
      expect(r.backup.persons).toEqual([]);
    }
  });
});

describe('두 폰이 주고받으면 같은 결과로 수렴한다', () => {
  it('서로 다른 지출을 넣었으면 둘 다 살아남는다', () => {
    const A = [expense('a1', 10_000)];
    const B = [expense('b1', 20_000)];

    // A → B 로 보냄
    const bAfter = mergeById(B, parseBackupExpenses(A));
    // B → A 로 보냄
    const aAfter = mergeById(A, parseBackupExpenses(bAfter));

    expect(aAfter.map(e => e.id).sort()).toEqual(['a1', 'b1']);
    expect(bAfter.map(e => e.id).sort()).toEqual(['a1', 'b1']);
  });

  it('한쪽에서 지운 항목이 되살아나지 않는다', () => {
    const A = [expense('x1', 10_000, 500, true)];   // A가 나중에 지움
    const B = [expense('x1', 10_000, 100)];         // B는 아직 살아있는 옛 사본

    const bAfter = mergeById(B, parseBackupExpenses(A));
    expect(bAfter[0].deleted).toBe(true);

    // B가 다시 A에게 보내도 되살아나면 안 된다
    const aAfter = mergeById(A, parseBackupExpenses(bAfter));
    expect(aAfter[0].deleted).toBe(true);
  });

  it('같은 항목을 각자 고쳤으면 나중에 고친 게 이긴다', () => {
    const A = [expense('x1', 10_000, 300)];
    const B = [expense('x1', 99_000, 800)];
    const merged = mergeById(A, parseBackupExpenses(B));
    expect(merged[0].amount).toBe(99_000);
  });

  it('여러 번 주고받아도 결과가 안 바뀐다', () => {
    const A = [expense('a1', 10_000)];
    const B = [expense('b1', 20_000)];
    const once = mergeById(A, parseBackupExpenses(B));
    const twice = mergeById(once, parseBackupExpenses(B));
    expect(twice).toEqual(once);
  });

  /** 실제 흐름대로 직렬화 → 파싱을 거쳐서 지출만 뽑는다 */
  function parseBackupExpenses(expenses: Expense[]): Expense[] {
    const b = buildBackup({ persons: PERSONS, incomes: [], fixedExpenses: [], expenses });
    const r = parseBackup(serializeBackup(b));
    if (!r.ok) throw new Error(r.error);
    return r.backup.expenses;
  }
});

describe('mergePersons', () => {
  it('내 이름·색을 상대 것으로 덮어쓰지 않는다', () => {
    const local: Person[] = [{ id: 'p1', name: '남편', color: '#111111', order: 0 }];
    const incoming: Person[] = [{ id: 'p1', name: '나', color: '#3498db', order: 0 }];
    const out = mergePersons(local, incoming);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('남편');
    expect(out[0].color).toBe('#111111');
  });

  it('내게 없는 사람은 추가한다 (지출 주인이 빈칸이 되면 안 되므로)', () => {
    const local: Person[] = [{ id: 'p1', name: '나', color: '#3498db', order: 0 }];
    const incoming: Person[] = [
      { id: 'p1', name: '나', color: '#3498db', order: 0 },
      { id: 'p9', name: '장모님', color: '#27ae60', order: 5 },
    ];
    const out = mergePersons(local, incoming);
    expect(out).toHaveLength(2);
    expect(out[1].id).toBe('p9');
    expect(out[1].order).toBe(1);   // 순서는 내 목록 뒤로 다시 매긴다
  });

  it('추가할 사람이 없으면 원본을 그대로 돌려준다', () => {
    const local = PERSONS;
    expect(mergePersons(local, PERSONS)).toBe(local);
  });
});

describe('파일 이름과 요약', () => {
  it('날짜가 들어간 한글 파일명', () => {
    expect(backupFileName(new Date(2026, 6, 5))).toBe('우리집가계부_20260705.json');
  });

  it('요약은 살아있는 것만 센다', () => {
    const b = buildBackup({
      persons: PERSONS,
      incomes: [income('i1', 100)],
      fixedExpenses: [],
      expenses: [expense('e1', 1), expense('e2', 2, 100, true)],
    });
    expect(backupSummary(b)).toBe('지출 1건 · 수입 1건 · 고정지출 0건');
  });
});
