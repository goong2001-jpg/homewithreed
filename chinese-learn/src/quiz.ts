import { LESSONS } from './data/lessons';
import { LessonSet, QuizChoice, QuizKind, QuizQuestion } from './data/types';

export type Rng = () => number;

/** 시험 한 회차 문제 수 */
export const EXAM_SIZE = 10;

/** 문제를 만들려면 보기 4개가 필요하므로 최소 이만큼은 학습해야 한다 */
export const MIN_LEARNED = 4;

function shuffle<T>(items: T[], rng: Rng): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 오답 보기 3개를 뽑는다. 학습한 세트가 모자라면 전체 세트에서 채운다 */
function pickDistractors(target: LessonSet, pool: LessonSet[], rng: Rng): LessonSet[] {
  const near = pool.filter((l) => l.id !== target.id && l.category === target.category);
  const far = pool.filter((l) => l.id !== target.id && l.category !== target.category);
  const backup = LESSONS.filter((l) => l.id !== target.id && !pool.some((p) => p.id === l.id));

  // 같은 분류에서 먼저 뽑아 보기가 그럴듯해지도록 한다
  const ordered = [...shuffle(near, rng), ...shuffle(far, rng), ...shuffle(backup, rng)];
  return ordered.slice(0, 3);
}

function buildChoices(
  target: LessonSet,
  distractors: LessonSet[],
  toChoice: (l: LessonSet) => QuizChoice,
  rng: Rng
): { choices: QuizChoice[]; answerIndex: number } {
  const correct = toChoice(target);
  const all = shuffle([correct, ...distractors.map(toChoice)], rng);
  return { choices: all, answerIndex: all.findIndex((c) => c.label === correct.label) };
}

const BLANK = '＿＿';

/** 회화 문장에서 단어를 빈칸으로 바꾼다. 단어가 없으면 null */
export function blankOut(set: LessonSet): string | null {
  const { hanzi } = set.word;
  if (!set.phrase.hanzi.includes(hanzi)) return null;
  return set.phrase.hanzi.replace(hanzi, BLANK);
}

function makeQuestion(set: LessonSet, kind: QuizKind, pool: LessonSet[], rng: Rng): QuizQuestion {
  const distractors = pickDistractors(set, pool, rng);
  const id = `${set.id}-${kind}`;
  const wordChoice = (l: LessonSet): QuizChoice => ({ label: l.word.hanzi, sub: l.word.pinyin });
  const meaningChoice = (l: LessonSet): QuizChoice => ({ label: l.word.meaning });

  switch (kind) {
    case 'meaningWord': {
      const { choices, answerIndex } = buildChoices(set, distractors, wordChoice, rng);
      return {
        id,
        kind,
        setId: set.id,
        prompt: set.word.meaning,
        promptSub: '이 뜻을 가진 중국어는?',
        choices,
        answerIndex,
        explanation: `${set.word.hanzi} (${set.word.pinyin}) — ${set.word.meaning}`,
      };
    }
    case 'pinyinWord': {
      const { choices, answerIndex } = buildChoices(set, distractors, wordChoice, rng);
      return {
        id,
        kind,
        setId: set.id,
        prompt: set.word.pinyin,
        promptSub: '이 발음의 한자는?',
        choices,
        answerIndex,
        explanation: `${set.word.pinyin} = ${set.word.hanzi} (${set.word.meaning})`,
      };
    }
    case 'listenWord': {
      const { choices, answerIndex } = buildChoices(set, distractors, meaningChoice, rng);
      return {
        id,
        kind,
        setId: set.id,
        prompt: set.word.hanzi,
        promptSub: '🔊 를 눌러 듣고, 무슨 뜻인지 고르세요',
        speakText: set.word.hanzi,
        hidePrompt: true,
        choices,
        answerIndex,
        explanation: `${set.word.hanzi} (${set.word.pinyin}) — ${set.word.meaning}`,
      };
    }
    case 'phraseMeaning': {
      const { choices, answerIndex } = buildChoices(
        set,
        distractors,
        (l) => ({ label: l.phrase.meaning }),
        rng
      );
      return {
        id,
        kind,
        setId: set.id,
        prompt: set.phrase.hanzi,
        promptSub: set.phrase.pinyin,
        speakText: set.phrase.hanzi,
        choices,
        answerIndex,
        explanation: `${set.phrase.hanzi} — ${set.phrase.meaning}`,
      };
    }
    case 'phraseBlank': {
      const blanked = blankOut(set);
      if (blanked) {
        const { choices, answerIndex } = buildChoices(set, distractors, wordChoice, rng);
        return {
          id,
          kind,
          setId: set.id,
          prompt: blanked,
          promptSub: `"${set.phrase.meaning}" — 빈칸에 들어갈 말은?`,
          choices,
          answerIndex,
          explanation: `${set.phrase.hanzi} (${set.phrase.pinyin})`,
        };
      }
      // 단어가 문장에 그대로 없으면 뜻 문제로 대신한다
      return makeQuestion(set, 'wordMeaning', pool, rng);
    }
    case 'wordMeaning':
    default: {
      const { choices, answerIndex } = buildChoices(set, distractors, meaningChoice, rng);
      return {
        id,
        kind: 'wordMeaning',
        setId: set.id,
        prompt: set.word.hanzi,
        promptSub: set.word.pinyin,
        speakText: set.word.hanzi,
        choices,
        answerIndex,
        explanation: `${set.word.hanzi} (${set.word.pinyin}) — ${set.word.meaning}`,
      };
    }
  }
}

const KINDS_WITH_SOUND: QuizKind[] = [
  'wordMeaning',
  'meaningWord',
  'listenWord',
  'phraseMeaning',
  'phraseBlank',
  'pinyinWord',
];

const KINDS_SILENT: QuizKind[] = [
  'wordMeaning',
  'meaningWord',
  'pinyinWord',
  'phraseMeaning',
  'phraseBlank',
];

export interface BuildExamOptions {
  /** 문제 수 (기본 10문제) */
  count?: number;
  /** 소리를 못 내는 기기에서는 듣기 문제를 빼도록 false */
  listening?: boolean;
  rng?: Rng;
}

/**
 * 학습한 세트만으로 시험지를 만든다.
 * 세트가 문제 수보다 적으면 같은 세트를 다른 유형으로 다시 낸다.
 */
export function buildExam(learnedSets: LessonSet[], options: BuildExamOptions = {}): QuizQuestion[] {
  const { count = EXAM_SIZE, listening = true, rng = Math.random } = options;
  if (learnedSets.length < MIN_LEARNED) return [];

  const kinds = listening ? KINDS_WITH_SOUND : KINDS_SILENT;
  const questions: QuizQuestion[] = [];
  let round = 0;

  while (questions.length < count) {
    const sets = shuffle(learnedSets, rng);
    for (const set of sets) {
      if (questions.length >= count) break;
      // 한 세트가 두 번 나올 때는 유형을 바꿔서 낸다
      const kind = kinds[(round + set.id) % kinds.length];
      questions.push(makeQuestion(set, kind, learnedSets, rng));
    }
    round += 1;
    if (round > count + 1) break; // 안전장치: 무한 반복 방지
  }

  return questions.slice(0, count);
}

/** 맞은 개수 */
export function scoreExam(questions: QuizQuestion[], answers: (number | null)[]): number {
  return questions.reduce((sum, q, i) => (answers[i] === q.answerIndex ? sum + 1 : sum), 0);
}

/** 틀린 문제의 세트 id (중복 제거) */
export function wrongSetIds(questions: QuizQuestion[], answers: (number | null)[]): number[] {
  const ids = questions.filter((q, i) => answers[i] !== q.answerIndex).map((q) => q.setId);
  return Array.from(new Set(ids));
}
