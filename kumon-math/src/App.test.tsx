import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('앱이 켜지고 놀이 탭이 보인다', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /영어 단어/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /놀이터/ })).toBeInTheDocument();
});

test('단어 화면 위에 오늘 미션 3개 카드와 스트릭이 보인다', () => {
  render(<App />);
  expect(screen.getByText('📌 오늘 미션 3개')).toBeInTheDocument();
  expect(screen.getByText('단어 카드 10개 보기')).toBeInTheDocument();
  expect(screen.getByText('퀴즈 3개 맞히기')).toBeInTheDocument();
  expect(screen.getByText('놀이터 게임 1판')).toBeInTheDocument();
  expect(screen.getByText(/0일 연속/)).toBeInTheDocument();
  expect(screen.getByText(/복습 \d+ · 새 단어 \d+/)).toBeInTheDocument();
});
