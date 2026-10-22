import { fireEvent, render, screen } from '@testing-library/react';
import CbtExam from './CbtExam';
import { InProgressExam, STORAGE_KEYS } from '../data/types';
import { writtenQuestions } from '../data/writtenQuestions';
import { loadInProgressExam } from '../storage';

beforeEach(() => {
  localStorage.clear();
});

describe('CbtExam', () => {
  test('새 시험을 시작하면 진행 중 시험이 저장되고 보기는 섞인 순서로 나온다', () => {
    render(<CbtExam mode="quick" onExit={() => {}} />);
    const saved = loadInProgressExam();
    expect(saved).not.toBeNull();
    expect(saved!.mode).toBe('quick');
    expect(saved!.questionIds).toHaveLength(10);
    expect(saved!.deadlineAt).toBeGreaterThan(Date.now());

    // 첫 문제의 보기가 저장된 순열대로 화면에 보인다
    const first = writtenQuestions.find((q) => q.id === saved!.questionIds[0])!;
    const order = saved!.choiceOrders[first.id];
    const buttons = screen.getAllByRole('button', { name: /^[1-4]/ }).slice(0, 4);
    order.forEach((orig, i) => {
      expect(buttons[i]).toHaveTextContent(first.choices[orig]);
    });
  });

  test('답을 고르면 원래 보기 번호로 저장된다', () => {
    render(<CbtExam onExit={() => {}} />); // 정식 모의고사 — 자동 이동 없음
    const saved = loadInProgressExam()!;
    const first = writtenQuestions.find((q) => q.id === saved.questionIds[0])!;
    const order = saved.choiceOrders[first.id];

    // 화면의 두 번째 보기를 누르면 원래 인덱스 order[1] 이 기록된다
    const buttons = screen.getAllByRole('button', { name: /^[1-4]/ }).slice(0, 4);
    fireEvent.click(buttons[1]);
    expect(loadInProgressExam()!.answers[first.id]).toBe(order[1]);
    expect(screen.getByText('1 / 120 답안 표시')).toBeInTheDocument();
  });

  test('풀다 만 시험이 있으면 그대로 이어서 푼다', () => {
    const picked = writtenQuestions.slice(0, 10);
    const saved: InProgressExam = {
      mode: 'quick',
      questionIds: picked.map((q) => q.id),
      choiceOrders: Object.fromEntries(picked.map((q) => [q.id, [3, 2, 1, 0]])),
      answers: { [picked[0].id]: 1 },
      deadlineAt: Date.now() + 5 * 60 * 1000,
      current: 2,
    };
    localStorage.setItem(STORAGE_KEYS.inProgressExam, JSON.stringify(saved));

    render(<CbtExam mode="quick" onExit={() => {}} />);
    expect(screen.getByText(/이어서 풉니다/)).toBeInTheDocument();
    expect(screen.getByText(`3. ${picked[2].question}`)).toBeInTheDocument();
    expect(screen.getByText('1 / 10 답안 표시')).toBeInTheDocument();
    // 저장된 보기 순서(거꾸로)가 그대로다
    const buttons = screen.getAllByRole('button', { name: /^[1-4]/ }).slice(0, 4);
    expect(buttons[0]).toHaveTextContent(picked[2].choices[3]);
    // 남은 시간은 마감 시각 기준 (5분 이하)
    expect(screen.getByText(/⏱ [45]:\d\d/)).toBeInTheDocument();
  });

  test('마감이 지난 시험은 이어서 풀지 않는다', () => {
    const picked = writtenQuestions.slice(0, 10);
    localStorage.setItem(
      STORAGE_KEYS.inProgressExam,
      JSON.stringify({
        mode: 'quick',
        questionIds: picked.map((q) => q.id),
        choiceOrders: {},
        answers: {},
        deadlineAt: Date.now() - 1000,
        current: 0,
      })
    );
    render(<CbtExam mode="quick" onExit={() => {}} />);
    expect(screen.queryByText(/이어서 풉니다/)).toBeNull();
    expect(screen.getByText('0 / 10 답안 표시')).toBeInTheDocument();
  });

  test('시험 종료는 확인을 거치고, 취소하면 나가지 않는다', () => {
    const onExit = jest.fn();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CbtExam mode="quick" onExit={onExit} />);
    fireEvent.click(screen.getByText('시험 종료'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByText('시험 종료'));
    expect(onExit).toHaveBeenCalled();
    // 나가도 풀던 시험은 남아 있어 이어서 풀 수 있다
    expect(loadInProgressExam()).not.toBeNull();
    confirmSpy.mockRestore();
  });

  test('제출하면 기록이 저장되고 진행 중 시험은 지워진다', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CbtExam mode="quick" onExit={() => {}} />);
    const saved = loadInProgressExam()!;
    fireEvent.click(screen.getByText('바로 채점'));

    expect(loadInProgressExam()).toBeNull();
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) ?? '[]');
    expect(history).toHaveLength(1);
    expect(history[0].mode).toBe('quick');
    const notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.wrongNotes) ?? '[]');
    expect(notes).toHaveLength(saved.questionIds.length); // 안 푼 문제는 전부 오답
    expect(screen.getByText(/0 \/ 10 정답/)).toBeInTheDocument();
    (window.confirm as jest.Mock).mockRestore();
  });
});
