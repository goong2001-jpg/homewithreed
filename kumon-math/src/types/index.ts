export type Operation = 'add' | 'subtract' | 'multiply';

export interface Problem {
  num1: number;
  num2: number;
  operation: Operation;
  answer: number;
}

export interface AvatarItem {
  id: string;
  name: string;
  emoji: string;
  category: 'hat' | 'accessory' | 'background' | 'outfit' | 'special' | 'pet' | 'effect';
  price: number;
  owned: boolean;
  equipped: boolean;
  /** public/avatar/ 폴더의 이미지 파일명. 있으면 이모지 대신 그림으로 표시 */
  image?: string;
  /** 이 정답 개수 이상 풀어야 상점에 열림 (없으면 처음부터 구매 가능) */
  unlockAt?: number;
  /** 배경 제거 방식: 'none'=투명, 'white'=흰배경, 'black'=검정배경, 'green'=초록크로마키 */
  bgRemoval?: 'none' | 'white' | 'black' | 'green';
  /** true면 아바타 전체를 이 그림으로 교체 (전설의 완성 아바타) */
  fullImage?: boolean;
}

/** 코스별 학습 진행 기록 (최근 문제 정오답으로 승급 판정) */
export interface CourseProgress {
  attempted: number;
  correct: number;
  recent: boolean[];
}

export interface GameState {
  points: number;
  level: number;
  streak: number;
  totalCorrect: number;
  totalWrong: number;
  equippedItems: string[];
  ownedItems: string[];
  /** 현재 수학 코스 (curriculum/math.ts의 COURSES id) */
  courseId: string;
  /** 오늘의 미션 목표 (맞힌 문제 수) */
  dailyGoal: number;
  /** 오늘 맞힌 문제 수 (날짜 바뀌면 0으로) */
  todaySolved: number;
  /** 마지막으로 문제를 푼 날짜 (YYYY-M-D) */
  lastPlayedDate: string;
  /** 연속 출석 일수 */
  attendanceStreak: number;
  /** 미션 보상을 받은 날짜 (하루 1회 지급) */
  missionRewardDate: string;
  courseProgress: Record<string, CourseProgress>;
}

/**
 * (미래 확장용) 과목 공통 문제 인터페이스 — 영어/국어/한자 등
 * 수학은 생성형, 다른 과목은 JSON 문제 은행으로 이 형태를 채운다.
 */
export interface QuizItem {
  question: string;
  choices?: string[];
  answer: string;
  helper?: string;
}
