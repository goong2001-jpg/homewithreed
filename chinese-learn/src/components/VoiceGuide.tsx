import React, { useState } from 'react';
import { chineseVoiceName, speak, VoiceStatus } from '../speech';

interface Props {
  open: boolean;
  status: VoiceStatus;
  onClose: () => void;
  /** 음성을 설치한 뒤 다시 확인 */
  onRecheck: () => void;
}

/**
 * 중국어 음성 설치 안내.
 * 한국어 음성이 你好를 "니호"라고 읽는 증상을 그대로 적어 두어야
 * 사용자가 자기 증상인 줄 안다.
 */
export default function VoiceGuide({ open, status, onClose, onRecheck }: Props) {
  const [tested, setTested] = useState<'idle' | 'ok' | 'fail'>('idle');
  if (!open) return null;

  const voiceName = chineseVoiceName();

  const test = () => {
    const result = speak('你好', { rate: 0.8 });
    setTested(result === 'ok' ? 'ok' : 'fail');
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">중국어 발음이 이상할 때</div>

        {status === 'unsupported' ? (
          <p>
            이 브라우저는 소리 읽기(음성 합성)를 지원하지 않습니다.
            안드로이드 <b>크롬</b>으로 열면 들을 수 있어요.
          </p>
        ) : status === 'ok' ? (
          <>
            <div className="verdict ok" style={{ marginBottom: 12 }}>
              중국어 음성이 준비됐습니다.
              <span className="explain">{voiceName}</span>
            </div>
            <p style={{ marginTop: 0 }}>
              그래도 발음이 어색하면 아래 버튼으로 你好(nǐ hǎo)를 확인해 보세요.
            </p>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              이 기기에 <b>중국어 음성이 설치되어 있지 않습니다.</b>{' '}
              그대로 읽히면 한국어 음성이 한자를 한국식으로 읽어
              你好를 <b>"니호"</b>처럼 발음해 버려서, 앱이 일부러 소리를 내지 않습니다.
            </p>
            <div className="steps">
              <div><b>설정</b> 앱을 엽니다</div>
              <div><b>일반 관리</b>(또는 시스템) → <b>언어 및 입력</b></div>
              <div><b>음성 텍스트 변환(TTS) 출력</b> → 기본 엔진 옆 ⚙️</div>
              <div><b>음성 데이터 설치</b> → <b>중국어(중국)</b> 내려받기</div>
              <div>돌아와서 아래 <b>다시 확인</b>을 누릅니다</div>
            </div>
            <p className="fine">
              삼성 폰은 "삼성 TTS", 그 외에는 "Google 음성 인식 및 합성"이 기본 엔진입니다.
              엔진을 Google로 바꾸면 중국어를 받기 쉽습니다.
            </p>
          </>
        )}

        {tested !== 'idle' && (
          <div className={`verdict ${tested === 'ok' ? 'ok' : 'no'}`}>
            {tested === 'ok'
              ? '소리가 났다면 준비 완료입니다.'
              : '아직 중국어 음성이 없습니다. 설치 후 다시 확인을 눌러 주세요.'}
          </div>
        )}

        <div className="nav-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={test}>
            🔊 你好 테스트
          </button>
          <button
            type="button"
            className="btn gold"
            onClick={() => {
              setTested('idle');
              onRecheck();
            }}
          >
            다시 확인
          </button>
        </div>
        <button type="button" className="btn wide" style={{ marginTop: 8 }} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
