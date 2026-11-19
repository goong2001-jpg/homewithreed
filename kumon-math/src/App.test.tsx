import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('앱이 켜지고 단어·책장·놀이터 탭이 보인다', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: '📖 단어' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '📚 책장' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '🎮 놀이터' })).toBeInTheDocument();
});

test('단어 화면 위에 영어 30분 카드와 추천 순서, 스트릭이 보인다', () => {
  render(<App />);
  expect(screen.getByText('⏱️ 오늘의 영어 30분')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '오늘 영어 0분 / 30분' })).toBeInTheDocument();
  expect(screen.getByText('단어 카드 10개 보기')).toBeInTheDocument();
  expect(screen.getByText('퀴즈 3개 맞히기')).toBeInTheDocument();
  expect(screen.getByText('책 1권 소리 내어 읽기')).toBeInTheDocument();
  expect(screen.getByText('놀이터 게임 1판')).toBeInTheDocument();
  expect(screen.getByText(/0일 연속/)).toBeInTheDocument();
  expect(screen.getByText(/복습 \d+ · 새 단어 \d+/)).toBeInTheDocument();
});
