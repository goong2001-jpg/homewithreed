import { act, renderHook } from '@testing-library/react';
import { useGameState } from './useGameState';

const STORAGE_KEY = 'kumon_game_state';

beforeEach(() => {
  localStorage.clear();
});

describe('useGameState', () => {
  it('recordCorrect 는 별과 정답 개수를 함께 올리고 저장한다', () => {
    const { result } = renderHook(() => useGameState());
    expect(result.current.gameState.totalCorrect).toBe(0);

    act(() => result.current.recordCorrect(2));
    act(() => result.current.recordCorrect(2));

    expect(result.current.gameState.points).toBe(4);
    expect(result.current.gameState.totalCorrect).toBe(2);

    // 다른 화면의 훅(상점)도 같은 값을 보도록 localStorage 에 남는다
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.totalCorrect).toBe(2);
    expect(saved.points).toBe(4);

    const fresh = renderHook(() => useGameState());
    expect(fresh.result.current.gameState.totalCorrect).toBe(2);
  });

  it('addPoints 는 별만 올리고 정답 개수는 그대로다', () => {
    const { result } = renderHook(() => useGameState());
    act(() => result.current.addPoints(3));
    expect(result.current.gameState.points).toBe(3);
    expect(result.current.gameState.totalCorrect).toBe(0);
  });

  it('저장이 실패해도 놀이는 계속된다', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useGameState());
    expect(() => act(() => result.current.recordCorrect(2))).not.toThrow();
    expect(result.current.gameState.totalCorrect).toBe(1);
    spy.mockRestore();
  });
});
