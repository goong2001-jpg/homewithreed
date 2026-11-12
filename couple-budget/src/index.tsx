import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
// 오프라인에서도 앱이 열리게 한다 (v17) — 배포본에서만. 자세한 동작은 public/sw.js 주석.
// 등록이 실패해도 앱은 그대로 돈다 (서비스워커가 없던 예전과 같다).
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/sw.js`).catch(() => {});
  });
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
