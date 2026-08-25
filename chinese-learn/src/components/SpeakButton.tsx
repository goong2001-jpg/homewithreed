import React, { useState } from 'react';
import { speak } from '../speech';

interface Props {
  text: string;
  /** 버튼에 보일 글자 */
  children: React.ReactNode;
  /** 0.5 = 아주 느리게 */
  rate?: number;
  className?: string;
}

/** 누르면 중국어를 읽어주는 버튼. 읽는 동안 버튼 색이 바뀐다 */
export default function SpeakButton({ text, children, rate, className = '' }: Props) {
  const [speaking, setSpeaking] = useState(false);

  const handle = () => {
    setSpeaking(true);
    speak(text, { rate, onEnd: () => setSpeaking(false) });
    // 음성이 끝났다는 신호가 안 오는 기기가 있어 안전장치를 둔다
    window.setTimeout(() => setSpeaking(false), 6000);
  };

  return (
    <button type="button" className={`btn ${speaking ? 'speaking' : ''} ${className}`} onClick={handle}>
      {children}
    </button>
  );
}
