import { PracticalQuestion, STORAGE_KEYS, SUBJECTS, WrittenQuestion } from './types';
import { writtenQuestions } from './writtenQuestions';
import { practicalQuestions } from './practicalQuestions';

// 내장 문제은행 + 사용자가 추가한 문제(localStorage)를 병합해 제공하는 계층

function loadList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function saveList(key: string, list: unknown[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 저장 실패(용량 초과, 프라이빗 모드 등)는 무시
  }
}

export function loadCustomWritten(): WrittenQuestion[] {
  return loadList<WrittenQuestion>(STORAGE_KEYS.customWritten);
}

export function loadCustomPractical(): PracticalQuestion[] {
  return loadList<PracticalQuestion>(STORAGE_KEYS.customPractical);
}

export function getAllWritten(): WrittenQuestion[] {
  return [...writtenQuestions, ...loadCustomWritten()];
}

export function getAllPractical(): PracticalQuestion[] {
  return [...practicalQuestions, ...loadCustomPractical()];
}

export function getQuestionById(id: string): WrittenQuestion | undefined {
  return getAllWritten().find((q) => q.id === id);
}

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function addCustomWritten(question: Omit<WrittenQuestion, 'id'>): WrittenQuestion {
  const saved: WrittenQuestion = { ...question, id: newId('cw') };
  saveList(STORAGE_KEYS.customWritten, [...loadCustomWritten(), saved]);
  return saved;
}

export function addCustomPractical(question: Omit<PracticalQuestion, 'id'>): PracticalQuestion {
  const saved: PracticalQuestion = { ...question, id: newId('cp') };
  saveList(STORAGE_KEYS.customPractical, [...loadCustomPractical(), saved]);
  return saved;
}

export function removeCustomWritten(id: string): void {
  saveList(
    STORAGE_KEYS.customWritten,
    loadCustomWritten().filter((q) => q.id !== id)
  );
}

export function removeCustomPractical(id: string): void {
  saveList(
    STORAGE_KEYS.customPractical,
    loadCustomPractical().filter((q) => q.id !== id)
  );
}

export function exportCustomJson(): string {
  return JSON.stringify(
    { written: loadCustomWritten(), practical: loadCustomPractical() },
    null,
    2
  );
}

// ── JSON 업로드 파싱/검증 ──

export interface ImportResult {
  written: WrittenQuestion[];
  practical: PracticalQuestion[];
  errors: string[];
}

interface RawItem {
  [key: string]: unknown;
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseWrittenItem(item: RawItem, index: number, errors: string[]): WrittenQuestion | null {
  const label = `필기 ${index + 1}번째 항목`;
  const subject = asTrimmedString(item.subject);
  const question = asTrimmedString(item.question);
  const explanation = asTrimmedString(item.explanation);
  const choices = Array.isArray(item.choices)
    ? item.choices.map((c) => asTrimmedString(c)).filter((c) => c.length > 0)
    : [];
  const answer = typeof item.answer === 'number' ? item.answer : NaN;

  if (!SUBJECTS.includes(subject as (typeof SUBJECTS)[number])) {
    errors.push(`${label}: subject가 6개 과목명 중 하나가 아닙니다 ("${subject}")`);
    return null;
  }
  if (!question) {
    errors.push(`${label}: question이 비어 있습니다`);
    return null;
  }
  if (choices.length !== 4) {
    errors.push(`${label}: choices는 빈 항목 없이 4개여야 합니다 (현재 ${choices.length}개)`);
    return null;
  }
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) {
    errors.push(`${label}: answer는 0~3 사이의 정답 번호(0부터 시작)여야 합니다`);
    return null;
  }
  return {
    id: newId('cw'),
    subject: subject as WrittenQuestion['subject'],
    question,
    choices,
    answer,
    explanation: explanation || '(해설 없음)',
  };
}

function parsePracticalItem(
  item: RawItem,
  index: number,
  errors: string[]
): PracticalQuestion | null {
  const label = `실기 ${index + 1}번째 항목`;
  const category = asTrimmedString(item.category) || '기타';
  const question = asTrimmedString(item.question);
  const answer = asTrimmedString(item.answer);
  const explanation = asTrimmedString(item.explanation);

  if (!question) {
    errors.push(`${label}: question이 비어 있습니다`);
    return null;
  }
  if (!answer) {
    errors.push(`${label}: answer(정답)가 비어 있습니다`);
    return null;
  }
  return {
    id: newId('cp'),
    category,
    question,
    answer,
    ...(explanation ? { explanation } : {}),
  };
}

/**
 * 업로드된 JSON 텍스트를 파싱·검증한다. 저장은 하지 않는다.
 * 형식: { "written": [...], "practical": [...] } 또는 배열만 있을 경우 필기로 간주.
 */
export function parseImportJson(text: string): ImportResult {
  const result: ImportResult = { written: [], practical: [], errors: [] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    result.errors.push('JSON 형식이 아닙니다. 템플릿 예시와 같은 형식인지 확인해 주세요.');
    return result;
  }

  let writtenRaw: unknown[] = [];
  let practicalRaw: unknown[] = [];
  if (Array.isArray(data)) {
    writtenRaw = data;
  } else if (data && typeof data === 'object') {
    const obj = data as RawItem;
    writtenRaw = Array.isArray(obj.written) ? obj.written : [];
    practicalRaw = Array.isArray(obj.practical) ? obj.practical : [];
    if (writtenRaw.length === 0 && practicalRaw.length === 0) {
      result.errors.push('"written" 또는 "practical" 배열이 없습니다.');
      return result;
    }
  } else {
    result.errors.push('JSON 최상위는 객체 또는 배열이어야 합니다.');
    return result;
  }

  writtenRaw.forEach((item, i) => {
    const parsed = parseWrittenItem((item ?? {}) as RawItem, i, result.errors);
    if (parsed) result.written.push(parsed);
  });
  practicalRaw.forEach((item, i) => {
    const parsed = parsePracticalItem((item ?? {}) as RawItem, i, result.errors);
    if (parsed) result.practical.push(parsed);
  });
  return result;
}

/** 파싱 결과를 실제로 저장한다. */
export function saveImportResult(result: ImportResult): void {
  if (result.written.length > 0) {
    saveList(STORAGE_KEYS.customWritten, [...loadCustomWritten(), ...result.written]);
  }
  if (result.practical.length > 0) {
    saveList(STORAGE_KEYS.customPractical, [...loadCustomPractical(), ...result.practical]);
  }
}

export const IMPORT_TEMPLATE = `{
  "written": [
    {
      "subject": "산업재해 예방 및 안전보건교육",
      "question": "문제 내용을 여기에 입력",
      "choices": ["보기 1", "보기 2", "보기 3", "보기 4"],
      "answer": 0,
      "explanation": "해설 (answer는 정답 보기의 번호, 0부터 시작: 첫 번째 보기 = 0)"
    }
  ],
  "practical": [
    {
      "category": "안전관리론",
      "question": "실기 필답형 문제 내용",
      "answer": "정답 내용",
      "explanation": "해설 (선택사항)"
    }
  ]
}`;

// ── 시험지 구성 ──

export const QUESTIONS_PER_SUBJECT = 20;
export const QUICK_QUESTION_COUNT = 10;

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** 정식 모의고사: 6과목 × 20문제 */
export function buildFullExam(): WrittenQuestion[] {
  const bank = getAllWritten();
  return SUBJECTS.flatMap((subject) =>
    shuffle(bank.filter((q) => q.subject === subject)).slice(0, QUESTIONS_PER_SUBJECT)
  );
}

/**
 * 간이시험: 여러 과목이 고루 섞이도록 과목별로 한 문제씩 번갈아 뽑는다.
 * 문제은행이 부족하면 가능한 만큼만 반환한다.
 */
export function buildQuickExam(count: number = QUICK_QUESTION_COUNT): WrittenQuestion[] {
  const bank = getAllWritten();
  const pools = shuffle(
    SUBJECTS.map((subject) => shuffle(bank.filter((q) => q.subject === subject)))
  ).filter((pool) => pool.length > 0);
  const maxRounds = pools.reduce((max, pool) => Math.max(max, pool.length), 0);

  const picked: WrittenQuestion[] = [];
  for (let round = 0; round < maxRounds && picked.length < count; round++) {
    for (let i = 0; i < pools.length && picked.length < count; i++) {
      if (pools[i].length > round) picked.push(pools[i][round]);
    }
  }
  return shuffle(picked);
}
