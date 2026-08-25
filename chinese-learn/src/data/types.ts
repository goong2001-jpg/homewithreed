/** 한 세트 = 단어 1개 + 그 단어가 들어간 즉시 사용 회화 1개 */

export interface Word {
  /** 간체자 */
  hanzi: string;
  /** 병음 (성조 표기) */
  pinyin: string;
  /** 한국어 뜻 */
  meaning: string;
}

export interface Phrase {
  hanzi: string;
  pinyin: string;
  meaning: string;
  /** 어떤 상황에서 쓰는 말인지 한 줄 설명 */
  situation: string;
}

export type Category = '인사' | '소통' | '쇼핑' | '식당' | '교통' | '숙소' | '위급';

export interface LessonSet {
  /** 1부터 시작하는 세트 번호이자 고유 id */
  id: number;
  category: Category;
  word: Word;
  phrase: Phrase;
  /** 외우기 쉽게 붙이는 한 줄 팁 */
  tip: string;
}

export const STORAGE_KEYS = {
  learned: 'chinese-learn:learned',
  exams: 'chinese-learn:exams',
} as const;

/** 시험 문제 유형 */
export type QuizKind =
  | 'wordMeaning'   // 한자를 보고 뜻 고르기
  | 'meaningWord'   // 뜻을 보고 한자 고르기
  | 'pinyinWord'    // 병음을 보고 한자 고르기
  | 'listenWord'    // 소리를 듣고 한자 고르기
  | 'phraseMeaning' // 회화 문장의 뜻 고르기
  | 'phraseBlank';  // 회화 문장의 빈칸에 들어갈 단어 고르기

export interface QuizChoice {
  /** 보기에 보이는 글자 */
  label: string;
  /** 보기 아래 작게 붙는 병음/설명 (없을 수 있음) */
  sub?: string;
}

export interface QuizQuestion {
  id: string;
  kind: QuizKind;
  /** 문제로 삼은 세트 id */
  setId: number;
  /** 문제 지문 */
  prompt: string;
  /** 지문 아래 작은 안내 */
  promptSub?: string;
  /** 🔊 버튼을 눌렀을 때 읽어줄 중국어. 없으면 버튼을 숨긴다 */
  speakText?: string;
  /** 듣기 문제처럼 지문에 정답이 그대로 보이면 안 되는 경우 true */
  hidePrompt?: boolean;
  choices: QuizChoice[];
  answerIndex: number;
  /** 채점 후 보여줄 해설 */
  explanation: string;
}

export interface ExamRecord {
  /** ISO 문자열 */
  takenAt: string;
  total: number;
  correct: number;
  /** 틀린 문제의 세트 id */
  wrongSetIds: number[];
}
