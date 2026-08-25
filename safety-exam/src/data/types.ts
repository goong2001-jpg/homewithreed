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

export const STORAGE_KEYS = {
  wrongNotes: 'safety-exam-wrong-notes',
  history: 'safety-exam-history',
  practicalProgress: 'safety-exam-practical-progress',
  customWritten: 'safety-exam-custom-written',
  customPractical: 'safety-exam-custom-practical',
} as const;
