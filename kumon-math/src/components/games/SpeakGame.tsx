import React, { useEffect, useRef, useState } from 'react';
import { Word } from '../../words/wordBank';
import { pickRandom } from '../../words/pool';
import { heardWord } from '../../words/hearing';
import { speakWord } from '../../alphabet/speech';
import { playClick, playCorrect, playStreak, playWrong } from '../../utils/sounds';
import { bigBtn, card, Finish, GameProps, lineBtn } from './common';

/**
 * 따라 말하기 — 요정이 말한 단어를 아이가 마이크에 대고 따라 말한다.
 * 브라우저 음성 인식(Web Speech API)이 알아들으면 별을 준다.
 * 음성 인식이 안 되는 기기에서는 따라 말한 뒤 스스로 "말했어요"를 누른다.
 */
const ROUND = 5;
/** 이만큼 못 알아들으면 "넘어가기"를 보여준다 */
const TRIES_BEFORE_SKIP = 2;
/** 마이크가 이 시간 동안 아무 답이 없으면 그만 듣는다 (멈춘 것처럼 보이지 않게) */
const LISTEN_TIMEOUT_MS = 8000;

function recognitionClass(): any {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type State = 'idle' | 'listening' | 'right' | 'wrong';

export default function SpeakGame({ pool, onStars, onBack }: GameProps) {
  const [words, setWords] = useState<Word[]>(() => pickRandom(pool, ROUND));
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState<State>('idle');
  const [heard, setHeard] = useState('');
  const [tries, setTries] = useState(0);
  const [score, setScore] = useState(0);
  // 마이크를 쓸 수 없으면(지원 안 함·권한 거절) 스스로 확인하는 방식으로 바꾼다
  const [manual, setManual] = useState(() => !recognitionClass());
  const recRef = useRef<any>(null);
  const word = words[idx];
  const done = idx >= words.length;

  useEffect(() => {
    if (word) { const t = setTimeout(() => speakWord(word.en), 300); return () => clearTimeout(t); }
  }, [word]);
  useEffect(() => { if (done && words.length) playStreak(); }, [done, words.length]);
  // 화면을 떠날 때 마이크를 끈다
  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  const next = () => { setIdx(i => i + 1); setState('idle'); setHeard(''); setTries(0); };
  const success = () => {
    playCorrect();
    setState('right');
    setScore(s => s + 1);
    onStars(1);
    setTimeout(next, 1400);
  };

  const listen = () => {
    const Rec = recognitionClass();
    if (!Rec || state === 'listening') return;
    playClick();
    let got = false;
    const miss = () => { setHeard(''); setState('wrong'); setTries(t => t + 1); };
    try {
      const rec = new Rec();
      recRef.current = rec;
      const timer = setTimeout(() => {
        if (got) return;
        got = true;
        try { rec.abort(); } catch {}
        miss();
      }, LISTEN_TIMEOUT_MS);
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      rec.onresult = (e: any) => {
        if (got) return;
        got = true;
        clearTimeout(timer);
        const alts: string[] = [];
        for (let i = 0; i < e.results.length; i++) {
          for (let k = 0; k < e.results[i].length; k++) alts.push(String(e.results[i][k].transcript ?? ''));
        }
        setHeard(alts[0] ?? '');
        if (heardWord(word.en, alts)) success();
        else { playWrong(); setState('wrong'); setTries(t => t + 1); }
      };
      rec.onerror = (e: any) => {
        if (got) return;
        got = true;
        clearTimeout(timer);
        // 마이크 권한이 없거나, 쓸 수 없는 기기거나, 인터넷이 끊겼으면 — 스스로 확인하는 방식으로
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e?.error)) {
          setManual(true);
          setState('idle');
        } else miss();
      };
      rec.onend = () => { if (!got) { got = true; clearTimeout(timer); miss(); } };
      setState('listening');
      setHeard('');
      rec.start();
    } catch {
      setManual(true);
      setState('idle');
    }
  };

  if (!words.length) {
    return <div style={card}>아직 따라 말할 단어가 없어요. 단어를 먼저 배워 볼까요?<br /><br />
      <button onClick={onBack} style={lineBtn()}>돌아가기</button></div>;
  }
  if (done) {
    return <Finish emoji="🎤" title="또박또박 잘 말했어!" sub={`${score} / ${words.length} 단어`} stars={score}
      onAgain={() => { setWords(pickRandom(pool, ROUND)); setIdx(0); setScore(0); setState('idle'); setHeard(''); setTries(0); }}
      onBack={onBack} />;
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>🎤 따라 말하기 ({idx + 1} / {words.length})</div>
      <div style={{ fontSize: 86, lineHeight: 1.15, marginTop: 6 }}>{word.emoji}</div>
      <div style={{ fontSize: 34, fontWeight: 900, color: '#5b4b8a' }}>{word.en}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#888', marginBottom: 8 }}>{word.ko}</div>

      <button onClick={() => { speakWord(word.en); playClick(); }} style={{ ...lineBtn(), width: '100%', marginBottom: 10 }}>
        🔊 요정 말 듣기
      </button>

      {state === 'right' ? (
        <div style={{ fontSize: 20, fontWeight: 900, color: '#27ae60', padding: '12px 0' }}>⭕ 잘 말했어! +1 ⭐</div>
      ) : manual ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#a35f12', marginBottom: 8 }}>
            이 기기는 마이크로 듣지 못해요. 큰 소리로 따라 말하고 눌러요!
          </div>
          <button onClick={success} style={bigBtn()}>🗣️ 따라 말했어요! ✅</button>
        </>
      ) : (
        <>
          <button onClick={listen} disabled={state === 'listening'} style={{
            ...bigBtn(state !== 'listening'), fontSize: 18,
            background: state === 'listening' ? 'linear-gradient(135deg,#ff9a9e,#f5576c)' : 'linear-gradient(135deg,#667eea,#764ba2)',
            cursor: state === 'listening' ? 'default' : 'pointer',
          }}>
            {state === 'listening' ? '👂 듣고 있어요… 말해 봐!' : '🎤 누르고 말하기'}
          </button>
          {state === 'wrong' && (
            <div style={{ fontSize: 14, fontWeight: 800, color: '#e67e22', marginTop: 10 }}>
              {heard ? <>"{heard}" 라고 들렸어요. 한 번 더! 💪</> : <>잘 안 들렸어요. 조금 더 크게 말해 봐! 💪</>}
            </div>
          )}
          {tries >= TRIES_BEFORE_SKIP && state !== 'listening' && (
            <button onClick={() => { playClick(); next(); }} style={{
              marginTop: 10, border: 'none', background: 'none', color: '#999', fontSize: 14, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>다음 단어로 넘어가기 →</button>
          )}
        </>
      )}
    </div>
  );
}
