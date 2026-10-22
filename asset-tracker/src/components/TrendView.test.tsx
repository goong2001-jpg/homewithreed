import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_KINDS } from '../types';
import { upsertMonthlySnapshot } from '../utils/snapshot';
import { summarize } from '../utils/summary';
import TrendView from './TrendView';

function snap(month: string, value: number) {
  const s = summarize({
    kinds: DEFAULT_KINDS,
    assets: [{
      id: 'a1', kindId: 'k_cash', name: '통장', value, principal: null, maturity: null,
      liquidity: null, memo: '', order: 0, createdAt: 0, updatedAt: 0,
    }],
    loans: [], recurrings: [],
  }, `${month}-15`);
  return upsertMonthlySnapshot([], s, `${month}-15`, 1)[0];
}

describe('TrendView', () => {
  it('스냅샷이 0~1개면 안내 문구를 띄운다', () => {
    const { unmount } = render(<TrendView snapshots={[]} today="2026-08-11" />);
    expect(screen.getByText('다음 달부터 추이가 보여요.')).toBeTruthy();
    unmount();

    render(<TrendView snapshots={[snap('2026-08', 1_000_000)]} today="2026-08-11" />);
    expect(screen.getByText('다음 달부터 추이가 보여요.')).toBeTruthy();
    expect(screen.getByText('1,000,000원')).toBeTruthy();
  });

  it('두 달 이상이면 그래프와 표를 그린다 (전월 대비 색/부호 포함)', () => {
    const snaps = [snap('2026-06', 1_000_000), snap('2026-07', 1_200_000), snap('2026-08', 1_100_000)];
    render(<TrendView snapshots={snaps} today="2026-08-11" />);
    expect(screen.getByRole('img', { name: /순자산 추이/ })).toBeTruthy();
    // 표: 최신 달이 먼저
    expect(screen.getByText('2026.08')).toBeTruthy();
    expect(screen.getByText(/−100,000/)).toBeTruthy();
    expect(screen.getByText(/\+200,000/)).toBeTruthy();
    // 전월 대비 (+20%)
    expect(screen.getByText('(+20%)')).toBeTruthy();
  });

  it('자산 / 부채 토글을 누르면 두 선과 범례가 나온다', () => {
    const snaps = [snap('2026-07', 1_000_000), snap('2026-08', 1_100_000)];
    render(<TrendView snapshots={snaps} today="2026-08-11" />);
    fireEvent.click(screen.getByRole('button', { name: '자산 / 부채' }));
    expect(screen.getByRole('img', { name: /자산과 부채 추이/ })).toBeTruthy();
    expect(screen.getAllByText('부채').length).toBeGreaterThan(0);
  });
});
