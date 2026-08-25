import React, { useState } from 'react';
import { speak } from '../speech';
import { useVoiceGuide } from '../voiceGuide';

interface Props {
  text: string;
  /** 버튼에 보일 글자 */
  children: React.ReactNode;
  /** 0.5 = 아주 느리게 */
  rate?: number;
  className?: string;
}

/**
 * 누르면 중국어를 읽어주는 버튼.
 * 기기에 중국어 음성이 없으면 소리를 내지 않고 설치 안내를 띄운다
 * (한국어 음성으로 읽으면 你好를 "니호"라고 읽어버린다).
 */
export default function SpeakButton({ text, children, rate, className = '' }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const { status, openGuide } = useVoiceGuide();
  // 'loading'(목록 로딩 중)은 막지 않는다. 눌렀을 때 speak()가 다시 확인한다
  const muted = status === 'no-voice' || status === 'unsupported';

  const handle = () => {
    if (muted) {
      openGuide();
      return;
    }
    setSpeaking(true);
    const result = speak(text, {
      rate,
      onEnd: () => setSpeaking(false),
      onUnavailable: () => {
        setSpeaking(false);
        openGuide();
      },
    });
    if (result !== 'ok') return;
    // 음성이 끝났다는 신호가 안 오는 기기가 있어 안전장치를 둔다
    window.setTimeout(() => setSpeaking(false), 6000);
  };

  return (
    <button
      type="button"
      className={`btn ${speaking ? 'speaking' : ''} ${muted ? 'muted' : ''} ${className}`}
      onClick={handle}
    >
      {muted ? '🔇 소리 설정' : children}
    </button>
  );
}
