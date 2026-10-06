import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { wordsForRound, questionsForDay, WORDS_PER_DAY, TEST_COUNT } from '../words/dailySet';
import { WORD_BANK } from '../words/wordBank';
import { drawCoupon, CouponKind, COUPONS } from '../words/coupons';
import { useWordProgress } from '../hooks/useWordProgress';
import { useGameState } from '../hooks/useGameState';
import { speakWord, speakPhonics, warmUpVoices, speechSupported } from '../alphabet/speech';
import { firstSoundKo, firstSoundPhrase } from '../words/phonics';
import Avatar from '../components/Avatar';
import Shop from '../components/Shop';
import CouponWallet from '../components/CouponWallet';
import { playCorrect, playWrong, playStreak, playClick } from '../utils/sounds';
import { SoundIntro, UnitPicker, ColoredWord } from '../components/SoundIntro';
import { UNITS } from '../words/units';

export default function WordScreen() {
  const {
    progress, learnNext, answer, earnCoupon, useCoupon, tradeCoupon,
    practiceAgain, totalCoupons, rewardedThisRound, couponsLeftToday,
    completeDay, chooseUnit,
  } = useWordProgress();
  const { gameState, items, buyItem, equipItem, addPoints } = useGameState();

  // 오답 노트에서 오늘 다시 볼 단어 (날이 바뀔 때 정해져 오늘 하루는 그대로다)
  const missedKey = progress.todayMissed.join('|');
  const missedWords = useMemo(
    () => WORD_BANK.filter(w => missedKey.split('|').includes(w.en)),
    [missedKey],
  );
  // 오늘 배우는 소리 단계 (날이 바뀔 때 정해진다)
  const plan = progress.todayPlan;
  const words = useMemo(
    () => wordsForRound(progress.round, { unit: plan.unit, unitDay: plan.unitDay }, undefined, missedWords),
    [progress.round, plan.unit, plan.unitDay, missedWords],
  );
  const [introOpen, setIntroOpen] = useState(
    progress.phase === 'learn' && progress.learned === 0 && progress.round === 0,
  );
  const [showUnits, setShowUnits] = useState(false);
  const todaySounds = UNITS[plan.unit % UNITS.length];
  // 단어는 묶음(round)이 정하고, 문제는 도전할 때마다(attempt) 달라진다.
  // 지난번에 틀렸던 단어는 문제로 먼저 나온다.
  const questions = useMemo(
    () => questionsForDay(words, progress.round * 100 + progress.attempt, undefined, missedKey.split('|')),
    [words, progress.round, progress.attempt, missedKey],
  );

  const [picked, setPicked] = useState<string | null>(null);
  const [showWallet, setShowWallet] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [drawn, setDrawn] = useState<CouponKind | null>(null);
  const roundRef = useRef(progress.round);
  const [drawing, setDrawing] = useState(false);
  const [happy, setHappy] = useState(false);
  // 보기를 눌러 첫소리를 들어보고, 확인 버튼으로 고른다
  const [selected, setSelected] = useState<string | null>(null);
  const rewardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { warmUpVoices(); }, []);

  // 새 회차를 시작하면 지난 회차에서 뽑은 쿠폰 카드를 치운다
  useEffect(() => {
    if (roundRef.current !== progress.round) {
      roundRef.current = progress.round;
      setDrawn(null);
    }
  }, [progress.round]);

  // 틀린 문제는 뒤로 다시 들어가므로, 지금 낼 문제는 queue 맨 앞이다
  const qIndex = progress.results.length;           // 지금까지 답한 횟수 (바뀔 때마다 새 문제)
  const solved = TEST_COUNT - progress.queue.length; // 맞힌 문제 수
  const wrongCount = progress.results.filter(r => !r).length;
  const question = questions[progress.queue[0] ?? 0];
  const isRetryQ = progress.results.length >= TEST_COUNT; // 틀렸던 문제를 다시 묻는 중
  const word = words[Math.min(progress.learned, words.length - 1)];

  // 단어가 바뀌면 자동으로 읽어준다
  useEffect(() => {
    if (progress.phase === 'learn' && word && !introOpen) {
      const t = setTimeout(() => speakWord(word.en), 300);
      return () => clearTimeout(t);
    }
  }, [progress.phase, progress.learned, word, introOpen]);

  // 문제가 바뀌면 그 단어를 읽어준다 (듣고 고르기)
  useEffect(() => {
    if (progress.phase === 'test' && question && picked === null) {
      const t = setTimeout(() => speakWord(question.word.en), 400);
      return () => clearTimeout(t);
    }
  }, [progress.phase, qIndex, question, picked]);

  const handleNextWord = useCallback(() => {
    playClick();
    addPoints(1);              // 단어 하나 볼 때마다 별 1개
    learnNext(WORDS_PER_DAY);
  }, [learnNext, addPoints]);

  const handleChoice = useCallback((en: string) => {
    if (picked !== null || !question) return;
    setPicked(en);
    const correct = en === question.word.en;
    if (correct) { playCorrect(); setHappy(true); addPoints(2); }
    else {
      playWrong();
      // 정답을 소리로도 들려줘서 머리에 남게 한다
      setTimeout(() => speakWord(question.word.en), 500);
    }
    // 처음 세 번은 각 문제를 처음 푸는 것, 그 뒤는 틀린 문제를 다시 푸는 것
    const firstTry = progress.results.length < TEST_COUNT;
    setTimeout(() => {
      setHappy(false);
      setPicked(null);
      setSelected(null);
      answer(correct, question.word.en, firstTry);
    }, correct ? 900 : 2600);
  }, [picked, question, answer, addPoints, progress.results.length]);

  // 틀린 문제도 결국 다 맞혀야 끝난다 — 끝났다면 모두 맞힌 것
  const testFinished = progress.queue.length === 0;
  useEffect(() => {
    if (progress.phase === 'test' && testFinished && progress.round === 0) completeDay();
  }, [progress.phase, testFinished, progress.round, completeDay]);
  const allCorrect = testFinished;

  // 다 맞히면 쿠폰 뽑기
  const handleDraw = useCallback(() => {
    if (drawing) return;
    setDrawing(true);
    playClick();
    let spins = 0;
    const spin = () => {
      spins++;
      setDrawn(COUPONS[spins % COUPONS.length]);
      if (spins < 14) setTimeout(spin, 90 + spins * 12);
      else {
        const prize = drawCoupon();
        setDrawn(prize);
        earnCoupon(prize.id);
        playStreak();
        setDrawing(false);
        setTimeout(() => rewardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
      }
    };
    spin();
  }, [drawing, earnCoupon]);

  const card: React.CSSProperties = {
    background: 'white', borderRadius: 24, padding: '22px 20px',
    width: '100%', maxWidth: 360, textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#fde2e4 0%,#cddafd 45%,#d7f9f1 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '14px 16px 40px',
      fontFamily: "'Nunito','Noto Sans KR',sans-serif",
    }}>
      {/* 상단 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', maxWidth: 380, marginBottom: 12,
      }}>
        <div style={{ fontSize: 21, fontWeight: 900, color: '#44405e' }}>📖 영어 단어</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: 'white', borderRadius: 14, padding: '7px 12px',
            fontSize: 14, fontWeight: 800, color: '#f39c12',
            boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
          }}>⭐ {gameState.points}</div>
          <button
            onClick={() => { setShowWallet(true); playClick(); }}
            style={{
              background: 'linear-gradient(135deg,#f6d365,#fda085)', color: '#5b4a2a',
              border: 'none', borderRadius: 14, padding: '8px 13px',
              fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(246,211,101,0.6)',
            }}
          >🎟️ {totalCoupons}</button>
          <button
            onClick={() => { setShowShop(true); playClick(); }}
            style={{
              background: 'linear-gradient(135deg,#f093fb,#f5576c)', color: 'white',
              border: 'none', borderRadius: 14, padding: '8px 11px',
              fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >🛍️</button>
        </div>
      </div>

      {/* 오늘 진행 */}
      <div style={{
        width: '100%', maxWidth: 380, background: 'white', borderRadius: 16,
        padding: '10px 16px', marginBottom: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 5 }}>
          <span>
            {progress.phase === 'learn' ? `오늘의 단어 ${progress.learned + 1} / ${WORDS_PER_DAY}`
              : progress.phase === 'test' ? (isRetryQ ? `틀린 단어 다시! (${solved} / ${TEST_COUNT} 맞힘)` : `문제 ${qIndex + 1} / ${TEST_COUNT}`)
              : '오늘 공부 끝! 🎉'}
          </span>
          <span style={{ color: '#9b59b6', fontWeight: 700 }}>📚 지금까지 {progress.totalLearned}개</span>
        </div>
        <div style={{ background: '#eee', borderRadius: 99, height: 9, overflow: 'hidden' }}>
          <div style={{
            width: `${progress.phase === 'done' ? 100
              : progress.phase === 'test'
                ? 60 + (solved / TEST_COUNT) * 40
                : (progress.learned / WORDS_PER_DAY) * 60}%`,
            height: '100%', borderRadius: 99,
            background: 'linear-gradient(90deg,#a18cd1,#fbc2eb)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* 오늘의 소리 — 누르면 단계를 고를 수 있다 */}
      <button
        onClick={() => { setShowUnits(true); playClick(); }}
        style={{
          width: '100%', maxWidth: 380, marginBottom: 10, padding: '9px 14px',
          borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(0,0,0,0.06)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: '#9b59b6' }}>
          🔤 오늘의 소리 ({plan.unit % UNITS.length + 1}단계)
        </span>
        <span style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>
          {todaySounds[0].label} <span style={{ color: '#e67e22' }}>{todaySounds[0].ko}</span>
          {'  ·  '}
          {todaySounds[1].label} <span style={{ color: '#e67e22' }}>{todaySounds[1].ko}</span>
        </span>
      </button>

      {/* 아바타 */}
      <div className={happy ? 'avatar-bounce' : ''} style={{ marginBottom: 10 }}>
        <Avatar items={items} mood={happy ? 'happy' : 'idle'} size="small" />
      </div>

      {/* ── 단어 배우기 ── */}
      {progress.phase === 'learn' && introOpen && (
        <SoundIntro unit={plan.unit} unitDay={plan.unitDay} onStart={() => setIntroOpen(false)} />
      )}

      {progress.phase === 'learn' && word && !introOpen && (
        <div style={card}>
          <div style={{ fontSize: 96, lineHeight: 1.1, marginBottom: 6 }}>{word.emoji}</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#5b4b8a', letterSpacing: 1 }}>
            <ColoredWord en={word.en} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#888', marginTop: 4, marginBottom: 16 }}>
            {word.ko}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { speakWord(word.en); playClick(); }}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 14,
                border: '2px solid #7c4dff', background: 'white', color: '#7c4dff',
                fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >🔊 다시 듣기</button>
            <button
              onClick={handleNextWord}
              style={{
                flex: 1.2, padding: '13px 0', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
                fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(102,126,234,0.45)',
              }}
            >
              {progress.learned + 1 >= WORDS_PER_DAY ? '문제 풀러 가기 →' : '다음 단어 →'}
            </button>
          </div>
        </div>
      )}

      {/* ── 테스트 ── */}
      {progress.phase === 'test' && !testFinished && question && (
        <div style={card}>
          {progress.todayMissed.includes(question.word.en) && progress.round === 0 && (
            <div style={{ fontSize: 12, fontWeight: 800, color: '#c0392b', marginBottom: 4 }}>
              📒 지난번에 틀렸던 단어!
            </div>
          )}
          {question.kind === 'picture' ? (
            <>
              {/* 거꾸로 문제: 영어를 듣고 알맞은 그림을 고른다 */}
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e67e22', marginBottom: 8 }}>
                잘 듣고 알맞은 그림을 골라봐! 👂
              </div>
              <div style={{ fontSize: 42, fontWeight: 900, color: '#5b4b8a', margin: '10px 0 8px' }}>
                {question.word.en}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e67e22', marginBottom: 8 }}>
                이건 영어로 뭘까? 🤔
              </div>
              <div style={{ fontSize: 86, lineHeight: 1.1 }}>{question.word.emoji}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#888', marginBottom: 6 }}>
                {question.word.ko}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
            <button
              onClick={() => { speakWord(question.word.en); playClick(); }}
              style={{
                border: '2px solid #7c4dff', background: 'white', borderRadius: 12,
                padding: '8px 14px', fontSize: 13, fontWeight: 800,
                color: '#7c4dff', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >🔊 다시 듣기</button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#a35f12', marginBottom: 8 }}>
            {question.kind === 'picture'
              ? '👆 그림을 골라서 확인을 눌러!'
              : '👆 보기를 누르면 첫소리가 들려요. 고른 뒤 확인!'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {question.choices.map(c => {
              const isPicked = picked === c.en;
              const isAnswer = c.en === question.word.en;
              const show = picked !== null;
              const isSel = selected === c.en;
              return (
                <button
                  key={c.en}
                  onClick={() => {
                    if (show) return;
                    setSelected(c.en);
                    if (question.kind === 'word') speakPhonics(firstSoundPhrase(c.en));
                    else playClick();
                  }}
                  disabled={show}
                  style={{
                    padding: '12px 6px', borderRadius: 16,
                    border: isSel && !show ? '3px solid #7c4dff' : '3px solid transparent',
                    background: show
                      ? (isAnswer ? 'linear-gradient(135deg,#84fab0,#8fd3f4)'
                        : isPicked ? '#ffd6d6' : '#f2f0fa')
                      : isSel ? '#ede7ff' : '#f2f0fa',
                    color: show && isAnswer ? '#1e5c40' : '#4a4463',
                    fontSize: 17, fontWeight: 800, cursor: show ? 'default' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.2s',
                    boxShadow: show && isAnswer ? '0 4px 14px rgba(39,174,96,0.3)' : 'none',
                  }}
                >
                  {question.kind === 'picture'
                    ? <span style={{ fontSize: 46, lineHeight: 1.1 }}>{c.emoji}</span>
                    : c.en}
                  {isSel && !show && question.kind === 'word' && (
                    <div style={{ fontSize: 12, color: '#e67e22', marginTop: 2 }}>
                      🔉 {firstSoundKo(c.en)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => selected && handleChoice(selected)}
            disabled={!selected || picked !== null}
            style={{
              width: '100%', marginTop: 12, padding: '14px 0', borderRadius: 16, border: 'none',
              background: selected && picked === null
                ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#ddd',
              color: 'white', fontSize: 17, fontWeight: 900,
              cursor: selected && picked === null ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}
          >이걸로 할래! ✅</button>
          {picked !== null && picked !== question.word.en && (
            <div style={{ marginTop: 12, fontSize: 15, fontWeight: 800, color: '#e74c3c' }}>
              아쉬워! 정답은 <b>{question.word.emoji} {question.word.en}</b> 이야
              <div style={{ fontSize: 13, color: '#a35f12', marginTop: 4 }}>
                이 단어는 조금 뒤에 다시 나와요. 기억해 둬! 🧠
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 테스트 결과 ── */}
      {progress.phase === 'test' && testFinished && (
        <div style={card}>
          <div style={{ fontSize: 56, marginBottom: 6 }}>{allCorrect ? '🎉' : '💪'}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: allCorrect ? '#27ae60' : '#e67e22', marginBottom: 6 }}>
            {wrongCount === 0 ? '3개 한 번에 다 맞았어!' : '틀렸던 단어도 다시 맞혔어! 💪'}
          </div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 16, lineHeight: 1.5 }}>
            {allCorrect
              ? (rewardedThisRound
                  ? (couponsLeftToday > 0
                      ? `한 번 더 하면 쿠폰을 또 받을 수 있어요! (오늘 ${couponsLeftToday}장 남음)`
                      : '오늘 받을 수 있는 쿠폰을 다 받았어요 😊')
                  : couponsLeftToday > 0
                    ? `쿠폰을 뽑을 수 있어요! (오늘 ${couponsLeftToday}장 남음)`
                    : '오늘 받을 수 있는 쿠폰을 다 받았어요 😊')
              : '다시 도전하면 쿠폰을 받을 수 있어요!'}
          </div>

          {allCorrect && !rewardedThisRound && couponsLeftToday > 0 && !drawn && (
            <button
              onClick={handleDraw}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
                background: 'linear-gradient(135deg,#f6d365,#fda085)', color: '#5b4a2a',
                fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 6px 20px rgba(246,211,101,0.7)',
              }}
            >🎁 쿠폰 뽑기!</button>
          )}

          {drawn && (
            <div ref={rewardRef} style={{
              background: drawn.color, borderRadius: 20, padding: '20px 16px',
              border: '3px dashed rgba(255,255,255,0.9)',
              animation: drawing ? 'none' : 'fadeIn 0.4s ease',
            }}>
              <div style={{ fontSize: 52 }}>{drawn.emoji}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#3b2f4a', marginTop: 4 }}>
                {drawn.name}
              </div>
              {!drawing && (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#5b4a6a', marginTop: 6 }}>
                  🎟️ 쿠폰 지갑에 담았어요!
                </div>
              )}
            </div>
          )}


          {allCorrect && !drawing && (rewardedThisRound || drawn || couponsLeftToday === 0) && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                onClick={() => { setShowWallet(true); playClick(); }}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14,
                  border: '2px solid #f0a868', background: 'white', color: '#d2823a',
                  fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >🎟️ 쿠폰 보기</button>
              <button
                onClick={() => { practiceAgain(); playClick(); }}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14,
                  border: '2px solid #7c4dff', background: 'white', color: '#7c4dff',
                  fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >새 단어로 한 번 더 ✏️</button>
            </div>
          )}
        </div>
      )}

      {/* ── 오늘 끝 ── */}
      {progress.phase === 'done' && (
        <div style={card}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🌟</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#27ae60', marginBottom: 8 }}>
            오늘 공부 다 했어요!
          </div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 18, lineHeight: 1.6 }}>
            내일 새로운 단어 10개가 기다려요.<br />
            더 하고 싶으면 한 번 더 연습할 수 있어요!
          </div>
          <button
            onClick={() => { practiceAgain(); playClick(); }}
            style={{
              width: '100%', padding: '15px 0', borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
              fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >한 번 더 연습하기 ✏️</button>
          <button
            onClick={() => { setShowWallet(true); playClick(); }}
            style={{
              width: '100%', marginTop: 10, padding: '13px 0', borderRadius: 14,
              border: '2px solid #f0a868', background: 'white', color: '#d2823a',
              fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >🎟️ 내 쿠폰 보기</button>
        </div>
      )}

      {/* 배운 단어 다시 듣기 — 문제를 푸는 동안에는 감춘다(답이 보이면 안 되므로) */}
      {(progress.phase === 'done' || (progress.phase === 'test' && testFinished)) && (
        <div style={{
          marginTop: 16, width: '100%', maxWidth: 360,
          background: 'rgba(255,255,255,0.75)', borderRadius: 18, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#8a7a9a', marginBottom: 8 }}>
            방금 배운 단어 (눌러서 다시 듣기)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {words.map(w => (
              <button
                key={w.en}
                onClick={() => { speakWord(w.en); playClick(); }}
                style={{
                  background: 'white', border: 'none', borderRadius: 10,
                  padding: '6px 9px', fontSize: 12, fontWeight: 700, color: '#5b4b8a',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {w.emoji} {w.en}
              </button>
            ))}
          </div>
        </div>
      )}

      {!speechSupported() && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#8a7aa8', textAlign: 'center' }}>
          이 브라우저는 읽어주기를 지원하지 않아요.
        </div>
      )}

      {showUnits && (
        <UnitPicker
          current={plan.unit}
          onChoose={u => { chooseUnit(u); setIntroOpen(true); }}
          onClose={() => setShowUnits(false)}
        />
      )}

      {showWallet && (
        <CouponWallet
          coupons={progress.coupons}
          history={progress.history}
          onUse={useCoupon}
          onTrade={tradeCoupon}
          onClose={() => setShowWallet(false)}
        />
      )}
      {showShop && (
        <Shop
          items={items}
          points={gameState.points}
          totalCorrect={gameState.totalCorrect}
          onBuy={buyItem}
          onEquip={equipItem}
          onClose={() => setShowShop(false)}
        />
      )}
    </div>
  );
}
