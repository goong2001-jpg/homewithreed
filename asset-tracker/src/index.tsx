import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * 오프라인용 서비스워커 (public/sw.js).
 *
 * 개발 서버에서는 등록하지 않는다 — 캐시가 코드 수정을 가려서 디버깅이 꼬인다.
 * 앱은 /homewithreed/asset-tracker/ 아래에 배포되므로 PUBLIC_URL 을 붙여야
 * 같은 도메인의 다른 앱과 scope 가 섞이지 않는다.
 * updateViaCache: 'none' — sw.js 자체는 늘 서버에서 새로 받아 새 버전이 바로 잡히게.
 */
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/sw.js`, { updateViaCache: 'none' })
      .catch(e => console.warn('서비스워커 등록 실패:', e));
  });
}
