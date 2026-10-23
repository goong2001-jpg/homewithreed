import React from 'react';

/** 화면 조각(놀이터·놀이)을 내려받는 동안 잠깐 보여주는 안내 */
export default function Loading() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, fontWeight: 800, color: '#7c4dff', fontFamily: "'Nunito','Noto Sans KR',sans-serif",
    }}>
      🧚 불러오는 중…
    </div>
  );
}
