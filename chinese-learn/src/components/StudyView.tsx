import React from 'react';
import { LESSONS } from '../data/lessons';
import { useVoiceGuide } from '../voiceGuide';
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
  const { openGuide } = useVoiceGuide();

  return (
    <>
      {voiceMissing && (
        <div className="notice">
          이 기기에 <b>중국어 음성이 없습니다.</b> 그대로 읽으면 한국어 음성이 한자를 한국식으로 읽어
          你好를 "니호"처럼 발음하기 때문에, 잘못 배우지 않도록 소리를 내지 않습니다.
          <button type="button" className="btn small" style={{ marginTop: 8 }} onClick={openGuide}>
            중국어 음성 설치 방법 보기
          </button>
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
