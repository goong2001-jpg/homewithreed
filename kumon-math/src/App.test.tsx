import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('앱이 켜지고 놀이 탭이 보인다', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /영어 단어/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /놀이터/ })).toBeInTheDocument();
});
