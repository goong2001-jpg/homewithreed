import React from 'react';
import { LESSONS } from '../data/lessons';
import SpeakButton from './SpeakButton';

interface Props {
  index: number;
  onIndexChange: (i: number) => void;
  learned: number[];
  onToggleLearned: (id: number) => void;
  voiceMissing: boolean;
}

export default function StudyView({ index, onIndexChange, learned, onToggleLearned, voiceMissing }: Props) {
  const set = LESSONS[index];
  const isLearned = learned.includes(set.id);

  return (
    <>
      {voiceMissing && (
        <div className="notice">
          이 기기에 중국어 음성이 없어 발음이 안 나올 수 있어요. 안드로이드
          <b> 설정 → 일반 관리 → 언어 → 음성 텍스트 변환(TTS)</b>에서 중국어(중국)를 내려받으면 들립니다.
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <span className="label">세트 {set.id} / {LESSONS.length} · 단어</span>
          <span className="badge">{set.category}</span>
        </div>
        <div className="hanzi" lang="zh-CN">{set.word.hanzi}</div>
        <div className="pinyin">{set.word.pinyin}</div>
        <div className="meaning">{set.word.meaning}</div>
        <div className="speak-row">
          <SpeakButton text={set.word.hanzi} className="primary">🔊 단어 듣기</SpeakButton>
          <SpeakButton text={set.word.hanzi} rate={0.5}>🐢 천천히</SpeakButton>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="label">바로 쓰는 회화</span>
          <span className="badge">{set.phrase.situation}</span>
        </div>
        <div className="hanzi sentence" lang="zh-CN">{set.phrase.hanzi}</div>
        <div className="pinyin">{set.phrase.pinyin}</div>
        <div className="meaning">{set.phrase.meaning}</div>
        <div className="speak-row">
          <SpeakButton text={set.phrase.hanzi} className="primary">🔊 문장 듣기</SpeakButton>
          <SpeakButton text={set.phrase.hanzi} rate={0.5}>🐢 천천히</SpeakButton>
        </div>
      </div>

      <div className="card">
        <div className="tip">💡 {set.tip}</div>
      </div>

      <button
        type="button"
        className={`done-toggle ${isLearned ? 'on' : ''}`}
        onClick={() => onToggleLearned(set.id)}
      >
        {isLearned ? '✓ 학습 완료 (시험에 나옵니다)' : '학습 완료로 표시하기'}
      </button>

      <div className="nav-row" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="btn"
          disabled={index === 0}
          onClick={() => onIndexChange(index - 1)}
        >
          ← 이전
        </button>
        <button
          type="button"
          className="btn gold"
          disabled={index === LESSONS.length - 1}
          onClick={() => onIndexChange(index + 1)}
        >
          다음 →
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="label">세트 고르기</span>
          <span className="label">{learned.length} / {LESSONS.length} 완료</span>
        </div>
        <div className="grid">
          {LESSONS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              className={`chip ${learned.includes(l.id) ? 'learned' : ''} ${i === index ? 'current' : ''}`}
              onClick={() => onIndexChange(i)}
            >
              {l.id}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
