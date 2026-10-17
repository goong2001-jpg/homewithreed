import React, { useEffect, useState } from 'react';
import { Word } from '../../words/wordBank';
import { pickRandom } from '../../words/pool';
import { speakWord } from '../../alphabet/speech';
import { playClick, playCorrect, playStreak, playWrong } from '../../utils/sounds';
import { bigBtn, card, Finish, GameProps, lineBtn } from './common';

/**
 * 선생님 놀이 — 아이가 선생님이 되어 엄마·아빠에게 문제를 낸다.
 * 가르치면서 가장 잘 외워진다.
 *
 * 아직 글을 못 읽어도 할 수 있게 정답은 글자 대신 소리로 확인한다.
 *  - 그림 문제: 그림을 보여주고 물어본 뒤 🔊 로 정답을 듣고 맞았는지 판정
 *  - 소리 문제: 🔊 를 누르면 요정이 영어로 말하고, 엄마·아빠가 그림을 고른다 (자동 채점)
 */
const ROUND = 5;
type Mode = 'picture' | 'sound';

export default function TeacherGame({ pool, onStars, onBack }: GameProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [words, setWords] = useState<Word[]>(() => pickRandom(pool, ROUND));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const word = words[idx];
  const done = idx >= words.length;

  useEffect(() => { if (done) { playStreak(); onStars(2); } }, [done, onStars]);

  const next = (correct: boolean) => { if (correct) setScore(s => s + 1); setIdx(i => i + 1); };
  const restart = () => { setWords(pickRandom(pool, ROUND)); setIdx(0); setScore(0); };

  if (!mode) {
    return (
      <div style={card}>
        <div style={{ fontSize: 40 }}>👩‍🏫</div>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#44405e', marginBottom: 4 }}>선생님 놀이</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>어떻게 문제를 낼까요?</div>
        <ModeButton emoji="🖼️" title="그림 문제" color="#f39c12"
          desc="그림을 보여주면 엄마·아빠가 영어로 말해요"
          onClick={() => { playClick(); restart(); setMode('picture'); }} />
        <ModeButton emoji="👂" title="소리 문제" color="#3498db"
          desc="요정이 영어로 말하면 엄마·아빠가 그림을 골라요"
          onClick={() => { playClick(); restart(); setMode('sound'); }} />
      </div>
    );
  }

  if (done) {
    return <Finish emoji="👩‍🏫" title="수업 끝! 선생님 최고!"
      sub={`엄마·아빠 점수: ${score} / ${words.length}`} stars={2}
      onAgain={() => { restart(); setMode(null); }} onBack={onBack} />;
  }

  const Card = mode === 'picture' ? PictureQuestion : SoundQuestion;
  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>
        👩‍🏫 {mode === 'picture' ? '그림 문제' : '소리 문제'} ({idx + 1} / {words.length})
      </div>
      <div style={{ fontSize: 13, color: '#888', margin: '4px 0 10px' }}>엄마·아빠 점수 {score}점</div>
      <Card key={idx} word={word} pool={pool} onNext={next} />
    </div>
  );
}

function ModeButton({ emoji, title, desc, color, onClick }: {
  emoji: string; title: string; desc: string; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
      padding: '14px 14px', borderRadius: 18, border: `3px solid ${color}`, background: 'white',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    }}>
      <span style={{ fontSize: 40 }}>{emoji}</span>
      <span>
        <div style={{ fontSize: 18, fontWeight: 900, color }}>{title}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#777' }}>{desc}</div>
      </span>
    </button>
  );
}

interface QuestionProps { word: Word; pool: Word[]; onNext: (correct: boolean) => void }

/** 정답을 못 맞혔을 때 — 선생님이 소리를 들려주고 같이 따라 말한다 */
function Teach({ word, onNext }: { word: Word; onNext: () => void }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#e74c3c', marginBottom: 10 }}>
        선생님이 알려 줘! 🔊 누르고 같이 따라 말해요 🗣️
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => { speakWord(word.en); playClick(); }} style={{ ...lineBtn(), fontSize: 20 }}>🔊</button>
        <button onClick={() => { playClick(); onNext(); }} style={lineBtn('#27ae60')}>다음 →</button>
      </div>
    </div>
  );
}

/**
 * 그림 문제 — 아이가 그림을 보여주고 "이건 영어로 뭘까?" 하고 묻는다.
 * 엄마·아빠가 대답하면 🔊 로 정답을 함께 듣고, 아이가 ⭕ / ❌ 를 누른다.
 * 정답 글자는 소리를 들은 뒤에만 보여서 엄마·아빠가 미리 볼 수 없다.
 */
function PictureQuestion({ word, onNext }: QuestionProps) {
  const [revealed, setRevealed] = useState(false);
  const [teaching, setTeaching] = useState(false);

  return (
    <div>
      <div style={{ background: '#fff8e7', borderRadius: 18, padding: '12px 10px', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#a35f12' }}>
          그림을 보여주고 물어봐: <b>"이건 영어로 뭘까?"</b>
        </div>
        <div style={{ fontSize: 96, lineHeight: 1.15 }}>{word.emoji}</div>
        {revealed ? (
          <>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#5b4b8a' }}>{word.en}</div>
            <div style={{ fontSize: 15, color: '#888', fontWeight: 700 }}>{word.ko}</div>
          </>
        ) : (
          <button
            onClick={() => { speakWord(word.en); playClick(); }}
            style={{
              marginTop: 4, padding: '6px 12px', borderRadius: 12, border: '2px dashed #e0b56a',
              background: 'white', color: '#a35f12', fontSize: 13, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >🙉 선생님만 몰래 듣기 (엄마·아빠는 귀 막기!)</button>
        )}
      </div>

      {!revealed ? (
        <button onClick={() => { setRevealed(true); speakWord(word.en); }} style={{ ...bigBtn(), fontSize: 18 }}>
          🔊 정답 듣기
        </button>
      ) : teaching ? (
        <Teach word={word} onNext={() => onNext(false)} />
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#888', marginBottom: 8 }}>
            엄마·아빠가 이렇게 말했나요?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { speakWord(word.en); playClick(); }} style={{ ...lineBtn(), flex: '0 0 60px', fontSize: 20 }}>🔊</button>
            <button onClick={() => { playCorrect(); onNext(true); }} style={{ ...lineBtn('#27ae60'), fontSize: 22 }}>⭕</button>
            <button onClick={() => { playWrong(); setTeaching(true); }} style={{ ...lineBtn('#e74c3c'), fontSize: 22 }}>❌</button>
          </div>
        </>
      )}
    </div>
  );
}

/** 정답 하나와 그림이 겹치지 않는 다른 단어 셋으로 보기 넷을 만든다 */
function makeChoices(word: Word, pool: Word[]): Word[] {
  const others = pickRandom(pool.filter(w => w.en !== word.en && w.emoji !== word.emoji), 30);
  const picked: Word[] = [];
  for (const w of others) {
    if (picked.length >= 3) break;
    if (!picked.some(p => p.emoji === w.emoji)) picked.push(w);
  }
  return pickRandom([word, ...picked], 4);
}

/**
 * 소리 문제 — 아이가 🔊 를 누르면 요정이 영어로 말한다.
 * 엄마·아빠가 그림을 누르면 앱이 맞았는지 알려 주므로 아이는 읽을 필요가 없다.
 */
function SoundQuestion({ word, pool, onNext }: QuestionProps) {
  const [choices] = useState(() => makeChoices(word, pool));
  const [asked, setAsked] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const right = picked === word.en;

  const ask = () => { speakWord(word.en); playClick(); setAsked(true); };
  const choose = (w: Word) => {
    if (!asked || picked) return;
    setPicked(w.en);
    if (w.en === word.en) { playCorrect(); setTimeout(() => speakWord(word.en), 350); }
    else playWrong();
  };

  return (
    <div>
      <button onClick={ask} style={{ ...bigBtn(), fontSize: 18, marginBottom: 6 }}>
        🔊 {asked ? '한 번 더 말하기' : '문제 내기'}
      </button>
      <div style={{ fontSize: 13, fontWeight: 800, color: asked ? '#3498db' : '#aaa', marginBottom: 10 }}>
        {asked ? '엄마·아빠, 들은 그림을 눌러요! 👇' : '선생님이 🔊 를 눌러서 문제를 내요'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {choices.map(c => {
          const isAnswer = c.en === word.en;
          const showRight = picked && isAnswer;
          const showWrong = picked === c.en && !isAnswer;
          return (
            <button key={c.en} onClick={() => choose(c)} style={{
              padding: '10px 0', borderRadius: 18, fontSize: 56, lineHeight: 1.2,
              border: `3px solid ${showRight ? '#27ae60' : showWrong ? '#e74c3c' : '#e6e1f5'}`,
              background: showRight ? '#eafaf1' : showWrong ? '#fdecea' : 'white',
              opacity: picked && !showRight && !showWrong ? 0.45 : asked ? 1 : 0.7,
              cursor: asked && !picked ? 'pointer' : 'default', fontFamily: 'inherit',
            }}>
              {c.emoji}
              {showRight && <div style={{ fontSize: 15, fontWeight: 900, color: '#27ae60' }}>{c.en}</div>}
            </button>
          );
        })}
      </div>

      {picked && (right ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#27ae60', marginBottom: 8 }}>⭕ 엄마·아빠가 맞혔어요!</div>
          <button onClick={() => { playClick(); onNext(true); }} style={bigBtn()}>다음 문제 →</button>
        </>
      ) : (
        <Teach word={word} onNext={() => onNext(false)} />
      ))}
    </div>
  );
}
