import { Problem, Operation } from '../types';

export interface Course {
  id: string;
  name: string;
  emoji: string;
  generate: (level: number) => Problem;
}

const rand = (n: number) => Math.floor(Math.random() * n);

// 코스 1: 10까지 더하기
function genAdd10(level: number): Problem {
  const maxSum = Math.min(10, 5 + Math.ceil(level / 4)); // 레벨 오르면 6→10
  const num1 = 1 + rand(maxSum - 1);
  let num2 = 1 + rand(Math.max(1, maxSum - num1));
  if (num1 + num2 > maxSum) num2 = Math.max(1, maxSum - num1);
  return { num1, num2, operation: 'add', answer: num1 + num2 };
}

// 코스 2: 20까지 더하기 빼기 (구몬 1~20±10 단계)
function genAddSub20(level: number): Problem {
  const operations: Operation[] = level <= 12 ? ['add'] : ['add', 'subtract'];
  const operation = operations[rand(operations.length)];

  let num1: number, num2: number;

  if (level <= 3) {
    num1 = rand(5) + 1;
    num2 = rand(Math.min(5, 10 - num1)) + 1;
  } else if (level <= 7) {
    num1 = rand(9) + 1;
    num2 = rand(9) + 1;
    if (num1 + num2 > 15) num2 = rand(15 - num1) + 1;
  } else if (level <= 12) {
    num1 = rand(10) + 1;
    num2 = 10;
  } else if (level <= 16) {
    if (operation === 'add') {
      num1 = rand(10) + 1;
      num2 = rand(9) + 1;
      if (num1 + num2 > 20) num2 = 20 - num1;
    } else {
      num1 = rand(10) + 11;
      num2 = rand(10) + 1;
    }
  } else {
    if (operation === 'add') {
      num1 = rand(15) + 6;
      num2 = rand(9) + 1;
    } else {
      num1 = rand(20) + 5;
      num2 = rand(num1 - 1) + 1;
    }
  }

  const answer = operation === 'add' ? num1 + num2 : num1 - num2;
  return { num1, num2, operation, answer };
}

// 코스 3: 두자리 더하기 빼기 (레벨 10까지는 받아올림/내림 없음)
function genTwoDigit(level: number): Problem {
  const regroup = level > 10;
  const operation: Operation = Math.random() < 0.5 ? 'add' : 'subtract';

  let num1: number, num2: number;
  if (operation === 'add') {
    const t1 = 1 + rand(4);                       // 십의 자리 1~4
    const t2 = 1 + rand(Math.min(4, 8 - t1));     // 합이 99를 넘지 않게
    const o1 = rand(10);
    const o2 = regroup ? rand(10) : rand(10 - o1); // 받아올림 없으면 o1+o2 ≤ 9
    num1 = t1 * 10 + o1;
    num2 = t2 * 10 + o2;
  } else {
    const t1 = 2 + rand(7);                       // 20~89
    const o1 = rand(10);
    const t2 = 1 + rand(t1 - 1);                  // 항상 num2 < num1
    const o2 = regroup ? rand(10) : rand(o1 + 1); // 받아내림 없으면 o2 ≤ o1
    num1 = t1 * 10 + o1;
    num2 = t2 * 10 + o2;
  }

  const answer = operation === 'add' ? num1 + num2 : num1 - num2;
  return { num1, num2, operation, answer };
}

// 코스 4: 구구단 (레벨 오를수록 높은 단이 열림)
function genTimes(level: number): Problem {
  const maxTable = Math.min(9, 1 + Math.ceil(level / 2.5)); // 레벨1→2단, 레벨20→9단
  const num1 = 2 + rand(Math.max(1, maxTable - 1));         // 단
  const num2 = 1 + rand(9);
  return { num1, num2, operation: 'multiply', answer: num1 * num2 };
}

export const COURSES: Course[] = [
  { id: 'add10',    name: '10까지 더하기',      emoji: '🌱', generate: genAdd10 },
  { id: 'addsub20', name: '20까지 더하기 빼기', emoji: '🌼', generate: genAddSub20 },
  { id: 'twodigit', name: '두자리 더하기 빼기', emoji: '🌳', generate: genTwoDigit },
  { id: 'times',    name: '구구단',             emoji: '🚀', generate: genTimes },
];

export function getCourse(id: string): Course {
  return COURSES.find(c => c.id === id) ?? COURSES[1];
}

export function getNextCourse(id: string): Course | null {
  const idx = COURSES.findIndex(c => c.id === id);
  return idx >= 0 && idx < COURSES.length - 1 ? COURSES[idx + 1] : null;
}

export function generateProblem(courseId: string, level: number): Problem {
  return getCourse(courseId).generate(Math.max(1, Math.min(20, level)));
}
