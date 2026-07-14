import { WrittenQuestion } from './types';
import subject1 from './written/subject1';
import subject2 from './written/subject2';
import subject3 from './written/subject3';
import subject4 from './written/subject4';
import subject5 from './written/subject5';
import subject6 from './written/subject6';

export const writtenQuestions: WrittenQuestion[] = [
  ...subject1,
  ...subject2,
  ...subject3,
  ...subject4,
  ...subject5,
  ...subject6,
];

export function getQuestionById(id: string): WrittenQuestion | undefined {
  return writtenQuestions.find((q) => q.id === id);
}
