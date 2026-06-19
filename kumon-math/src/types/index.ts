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
  category: 'hat' | 'accessory' | 'background' | 'outfit';
  price: number;
  owned: boolean;
  equipped: boolean;
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
