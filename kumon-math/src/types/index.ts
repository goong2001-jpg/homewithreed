export type Operation = 'add' | 'subtract';

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
  category: 'hat' | 'accessory' | 'background' | 'outfit' | 'special';
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

export interface GameState {
  points: number;
  level: number;
  streak: number;
  totalCorrect: number;
  totalWrong: number;
  equippedItems: string[];
  ownedItems: string[];
}
