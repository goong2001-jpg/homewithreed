export const SUBJECTS = [
  '산업재해 예방 및 안전보건교육',
  '인간공학 및 위험성 평가·관리',
  '기계·기구 및 설비 안전관리',
  '전기설비 안전관리',
  '화학설비 안전관리',
  '건설공사 안전관리',
] as const;

export type Subject = (typeof SUBJECTS)[number];

export interface WrittenQuestion {
  id: string;
  subject: Subject;
  question: string;
  choices: string[];
  answer: number; // 정답 선택지 인덱스 (0~3)
  explanation: string;
}

export interface PracticalQuestion {
  id: string;
  category: string;
  question: string;
  answer: string;
  explanation?: string;
}

export interface WrongNoteEntry {
  questionId: string;
  myAnswer: number;
  savedAt: string;
}

export interface SubjectScore {
  subject: Subject;
  correct: number;
  total: number;
}

export interface ExamRecord {
  date: string;
  scores: SubjectScore[];
  passed: boolean;
  /** 'quick'은 10문제 간이시험 기록 (없으면 정식 모의고사) */
  mode?: 'full' | 'quick';
}

/** 풀다 만 시험 — 화면을 떠나거나 새로고침해도 이어서 풀 수 있게 저장한다 */
export interface InProgressExam {
  mode: 'full' | 'quick';
  /** 출제된 문제 id (순서 그대로) */
  questionIds: string[];
  /** 문제별 보기 순서 — 원래 보기 인덱스의 순열 (예: [2,0,3,1]) */
  choiceOrders: Record<string, number[]>;
  /** 문제 id → 고른 보기 (원래 보기 인덱스 기준) */
  answers: Record<string, number>;
  /** 시험이 끝나는 시각 (Date.now() 기준 ms) */
  deadlineAt: number;
  /** 보고 있던 문제 번호 */
  current: number;
}

export const STORAGE_KEYS = {
  wrongNotes: 'safety-exam-wrong-notes',
  history: 'safety-exam-history',
  inProgressExam: 'safety-exam-in-progress',
  practicalProgress: 'safety-exam-practical-progress',
  customWritten: 'safety-exam-custom-written',
  customPractical: 'safety-exam-custom-practical',
} as const;
