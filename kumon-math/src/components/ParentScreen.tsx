import React, { useMemo, useRef, useState } from 'react';
import { WordProgress } from '../hooks/useWordProgress';
import { StreakState } from '../words/streak';
import { Settings, BigReward, exportBackup, importBackup } from '../words/settings';
import { readLog, readConfusions, topConfusions, lastDays, sumDays, weekOf, isStudyDay } from '../words/log';
import { MAX_BOX } from '../words/srs';
import { WORD_BANK } from '../words/wordBank';
import { COUPONS } from '../words/coupons';
import { UNITS } from '../words/units';
import { addDays, isoToday } from '../words/dates';
import { playClick } from '../utils/sounds';
import WeeklyCard from './WeeklyCard';
import { Certificate } from './GradTest';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const BOX_NAMES = ['다시 볼 단어', '처음 본 단어', '조금 아는 단어', '잘 아는 단어', '완전히 익힌 단어'];
const BOX_COLORS = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db'];

const section: React.CSSProperties = {
  background: 'white', borderRadius: 18, padding: '14px 14px', marginBottom: 12,
  boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
};
const h: React.CSSProperties = { fontSize: 15, fontWeight: 900, color: '#44405e', marginBottom: 8 };
const small: React.CSSProperties = { fontSize: 12, color: '#888', fontWeight: 700 };
const btn = (color = '#7c4dff'): React.CSSProperties => ({
  padding: '10px 12px', borderRadius: 12, border: `2px solid ${color}`, background: 'white', color,
  fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
});
const input: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 10, border: '2px solid #ddd', fontSize: 14, fontFamily: 'inherit',
  minWidth: 0, boxSizing: 'border-box',
};

function Stat({ n, label }: { n: React.ReactNode; label: string }) {
  return (
    <div style={{ flex: 1, background: '#f6f4fd', borderRadius: 12, padding: '8px 4px', textAlign: 'center' }}>
      <div style={{ fontSize: 19, fontWeight: 900, color: '#5b4b8a' }}>{n}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#8a7a9a' }}>{label}</div>
    </div>
  );
}

/**
 * 엄마·아빠 메뉴 — 곱셈 문제를 맞혀야 들어온다.
 * 아이의 기록(리포트), 쿠폰 그래프, 주간 칭찬 카드, 졸업장, 설정, 기록 백업을 한곳에 모았다.
 */
export default function ParentScreen({ progress, streak, settings, onChange, onClose }: {
  progress: WordProgress;
  streak: StreakState;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) {
  const today = isoToday();
  const log = useMemo(() => readLog(), []);
  const week = weekOf(log, today);
  const weekSum = sumDays(week.map(d => d.log));
  const answered = weekSum.right + weekSum.wrong;
  const days14 = lastDays(log, 14, today);
  const maxCoupon = Math.max(1, ...days14.map(d => Math.max(d.log.earned, d.log.used)));
  const sum14 = sumDays(days14.map(d => d.log));

  // 단어 상태
  const entries = Object.entries(progress.srs);
  const boxes = Array.from({ length: MAX_BOX + 1 }, (_, b) => entries.filter(([, e]) => e.box === b).length);
  const tough = entries.filter(([, e]) => e.wrong > 0).sort((a, b) => b[1].wrong - a[1].wrong).slice(0, 5);
  const confusions = topConfusions(readConfusions(), 3);
  const wordOf = (en: string) => WORD_BANK.find(w => w.en === en);
  const totalCoupons = COUPONS.reduce((s, c) => s + (progress.coupons[c.id] ?? 0), 0);
  const graduated = Object.entries(progress.graduated).map(([u, date]) => ({ unit: Number(u), date }))
    .sort((a, b) => a.unit - b.unit);

  const [card, setCard] = useState<string | null>(null);   // 보여줄 칭찬 카드의 날짜
  const [backup, setBackup] = useState('');
  const [restoreText, setRestoreText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const makeBackup = () => {
    playClick();
    const text = exportBackup();
    setBackup(text);
    setMsg(null);
  };
  const copyBackup = async () => {
    try { await navigator.clipboard.writeText(backup); setMsg('복사했어요! 메모장이나 카카오톡 "나에게 보내기"에 붙여 넣어 두세요.'); }
    catch { setMsg('복사하지 못했어요. 아래 글자를 길게 눌러 직접 복사해 주세요.'); }
  };
  const downloadBackup = () => {
    try {
      const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `영어단어-기록-${today}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setMsg('파일로 저장하지 못했어요. 복사하기를 써 주세요.'); }
  };
  const restore = (text: string) => {
    if (!text.trim()) { setMsg('불러올 백업 글자를 붙여 넣어 주세요.'); return; }
    if (!window.confirm('지금 기록을 지우고 백업한 기록으로 바꿀까요?')) return;
    const err = importBackup(text);
    if (err) { setMsg(err); return; }
    window.location.reload();
  };
  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(restore).catch(() => setMsg('파일을 읽지 못했어요.'));
    e.target.value = '';
  };

  const setReward = (i: number, patch: Partial<BigReward>) => {
    onChange({ bigRewards: settings.bigRewards.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto',
      background: 'linear-gradient(160deg,#eef1ff,#f7f0ff)',
      fontFamily: "'Nunito','Noto Sans KR',sans-serif",
    }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '14px 14px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#44405e' }}>👪 엄마·아빠 메뉴</div>
          <button onClick={() => { playClick(); onClose(); }} style={{
            background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36,
            fontSize: 17, fontWeight: 800, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* 이번 주 */}
        <div style={section}>
          <div style={h}>📅 이번 주</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {week.map((d, i) => {
              const on = isStudyDay(d.log);
              return (
                <div key={d.date} style={{
                  flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 10, fontSize: 12, fontWeight: 900,
                  background: on ? 'linear-gradient(135deg,#84fab0,#8fd3f4)' : '#f2f0fa',
                  color: on ? '#1e5c40' : '#bbb', outline: d.date === today ? '2px solid #7c4dff' : 'none',
                }}>
                  {DAYS[i]}<div style={{ fontSize: 11 }}>{on ? `${d.log.cards}장` : '-'}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Stat n={`${weekSum.studyDays}일`} label="공부한 날" />
            <Stat n={weekSum.newWords} label="새 단어" />
            <Stat n={answered ? `${Math.round((weekSum.right / answered) * 100)}%` : '-'} label="한 번에 맞힌 비율" />
            <Stat n={`🔥${streak.current}`} label={`연속 (최고 ${streak.best})`} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => { playClick(); setCard(today); }} style={{ ...btn(), flex: 1 }}>🏅 이번 주 칭찬 카드</button>
            <button onClick={() => { playClick(); setCard(addDays(today, -7)); }} style={{ ...btn(), flex: 1 }}>지난주 칭찬 카드</button>
          </div>
          <div style={{ ...small, marginTop: 8 }}>
            날짜별 기록은 이 기능이 들어온 뒤부터 쌓여요. 그 전 기록은 아래 "단어 상태"에 합쳐져 있어요.
          </div>
        </div>

        {/* 단어 상태 */}
        <div style={section}>
          <div style={h}>📚 단어 상태 — 본 단어 {entries.length}개 · 완전히 익힌 단어 {boxes[MAX_BOX]}개</div>
          {boxes.map((n, b) => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 104, fontSize: 12, fontWeight: 800, color: '#6b6b7d' }}>{BOX_NAMES[b]}</div>
              <div style={{ flex: 1, background: '#f2f0fa', borderRadius: 6, height: 12, overflow: 'hidden' }}>
                <div style={{ width: `${entries.length ? (n / entries.length) * 100 : 0}%`, height: '100%', background: BOX_COLORS[b] }} />
              </div>
              <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 900, color: '#44405e' }}>{n}</div>
            </div>
          ))}
          <div style={{ ...small, marginTop: 6 }}>
            소리 단계 {progress.unit + 1} / {UNITS.length} · 졸업한 단계 {graduated.length}개
          </div>
        </div>

        {/* 자주 틀리는 단어 */}
        <div style={section}>
          <div style={h}>🎯 자주 틀리는 단어</div>
          {tough.length === 0 ? <div style={small}>아직 틀린 단어가 없어요.</div> : tough.map(([en, e]) => (
            <div key={en} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#44405e', padding: '3px 0' }}>
              <span>{wordOf(en)?.emoji} {en} <span style={{ color: '#999', fontWeight: 700 }}>{wordOf(en)?.ko}</span></span>
              <span style={{ color: '#e74c3c' }}>틀림 {e.wrong} · <span style={{ color: '#27ae60' }}>맞힘 {e.correct}</span></span>
            </div>
          ))}
          {confusions.length > 0 && (
            <>
              <div style={{ ...h, marginTop: 10 }}>🔀 헷갈린 짝</div>
              {confusions.map(c => (
                <div key={`${c.a}|${c.b}`} style={{ fontSize: 14, fontWeight: 800, color: '#44405e', padding: '3px 0' }}>
                  {wordOf(c.a)?.emoji} {c.a} ↔ {wordOf(c.b)?.emoji} {c.b}
                  <span style={{ color: '#999', fontWeight: 700 }}> ({c.count}번)</span>
                </div>
              ))}
            </>
          )}
          <div style={{ ...small, marginTop: 6 }}>놀이터의 "특별 훈련"과 "헷갈리는 짝"에서 이 단어들을 연습해요.</div>
        </div>

        {/* 쿠폰 */}
        <div style={section}>
          <div style={h}>🎟️ 쿠폰 — 가진 쿠폰 {totalCoupons}장 · 저금통 {progress.piggy}장</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, marginBottom: 4 }}>
            {days14.map(d => (
              <div key={d.date} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%' }}
                title={`${d.date} 받음 ${d.log.earned} · 씀 ${d.log.used}`}>
                <div style={{ flex: 1, height: `${(d.log.earned / maxCoupon) * 100}%`, background: '#2ecc71', borderRadius: '3px 3px 0 0', minHeight: d.log.earned ? 3 : 0 }} />
                <div style={{ flex: 1, height: `${(d.log.used / maxCoupon) * 100}%`, background: '#e67e22', borderRadius: '3px 3px 0 0', minHeight: d.log.used ? 3 : 0 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...small }}>
            <span>{days14[0].date.slice(5)}</span><span>최근 14일</span><span>오늘</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>
            <span style={{ color: '#27ae60' }}>■ 받음 {sum14.earned}장</span>
            <span style={{ color: '#e67e22', marginLeft: 12 }}>■ 씀 {sum14.used}장</span>
            <span style={{ color: '#999', marginLeft: 12 }}>하루 가장 많을 때 {maxCoupon}장</span>
          </div>
        </div>

        {/* 졸업장 */}
        {graduated.length > 0 && (
          <div style={section}>
            <div style={h}>🎓 졸업장</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {graduated.map(g => <Certificate key={g.unit} unit={g.unit} date={g.date} name={settings.childName} />)}
            </div>
          </div>
        )}

        {/* 설정 */}
        <div style={section}>
          <div style={h}>⚙️ 설정</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#44405e', whiteSpace: 'nowrap' }}>아이 이름</span>
            <input value={settings.childName} maxLength={10} placeholder="칭찬 카드·졸업장에 넣어요"
              onChange={e => onChange({ childName: e.target.value })} style={{ ...input, flex: 1 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.approveUse}
              onChange={e => onChange({ approveUse: e.target.checked })} style={{ width: 22, height: 22 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#44405e' }}>
              쿠폰을 쓸 때 엄마·아빠 확인 받기
              <div style={small}>켜 두면 쿠폰을 쓰거나 큰 보상을 받을 때 곱셈 문제를 풀어야 해요.</div>
            </span>
          </label>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#44405e', marginBottom: 6 }}>🐷 저금통 큰 보상 (이름 · 필요한 쿠폰 수)</div>
          {settings.bigRewards.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{r.emoji}</span>
              <input value={r.name} maxLength={16} aria-label={`큰 보상 ${i + 1} 이름`}
                onChange={e => setReward(i, { name: e.target.value })} style={{ ...input, flex: 1 }} />
              <input type="number" min={1} max={99} value={r.cost} aria-label={`큰 보상 ${i + 1} 쿠폰 수`}
                onChange={e => setReward(i, { cost: Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 1))) })}
                style={{ ...input, width: 62 }} />
              <span style={small}>장</span>
            </div>
          ))}
        </div>

        {/* 백업 */}
        <div style={section}>
          <div style={h}>💾 기록 백업 · 옮기기</div>
          <div style={{ ...small, marginBottom: 10, lineHeight: 1.5 }}>
            기록은 이 기기의 브라우저에만 있어요. 인터넷 기록을 지우거나 기기를 바꾸면 사라지니 가끔 백업해 두세요.
          </div>
          <button onClick={makeBackup} style={{ ...btn('#27ae60'), width: '100%', marginBottom: 8 }}>📤 지금 기록 백업 만들기</button>
          {backup && (
            <>
              <textarea readOnly value={backup} aria-label="백업 글자" onFocus={e => e.target.select()}
                style={{ ...input, width: '100%', height: 70, fontSize: 11, marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button onClick={copyBackup} style={{ ...btn(), flex: 1 }}>📋 복사하기</button>
                <button onClick={downloadBackup} style={{ ...btn(), flex: 1 }}>📁 파일로 저장</button>
              </div>
            </>
          )}
          <div style={{ fontSize: 13, fontWeight: 800, color: '#44405e', margin: '6px 0' }}>📥 백업 불러오기</div>
          <textarea value={restoreText} onChange={e => setRestoreText(e.target.value)} aria-label="불러올 백업 글자"
            placeholder="복사해 둔 백업 글자를 여기에 붙여 넣으세요"
            style={{ ...input, width: '100%', height: 60, fontSize: 11, marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => restore(restoreText)} style={{ ...btn('#e67e22'), flex: 1 }}>붙여 넣은 글자로 불러오기</button>
            <button onClick={() => fileRef.current?.click()} style={{ ...btn('#e67e22'), flex: 1 }}>파일에서 불러오기</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json,text/plain" onChange={pickFile} style={{ display: 'none' }} />
          {msg && <div style={{ fontSize: 13, fontWeight: 800, color: '#b5478f', marginTop: 8 }}>{msg}</div>}
        </div>
      </div>

      {card && (
        <WeeklyCard log={log} date={card} name={settings.childName}
          title={card === today ? '이번 주 칭찬 카드' : '지난주 칭찬 카드'} onClose={() => setCard(null)} />
      )}
    </div>
  );
}
