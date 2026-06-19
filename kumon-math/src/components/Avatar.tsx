import React from 'react';
import { AvatarItem } from '../types';

type AvatarMood = 'idle' | 'happy' | 'sad' | 'thinking';

interface Props {
  items: AvatarItem[];
  mood: AvatarMood;
  size?: 'small' | 'large';
}

const MOOD_FACE: Record<AvatarMood, string> = {
  idle: '😊',
  happy: '🥳',
  sad: '😢',
  thinking: '🤔',
};

const MOOD_ANIMATION: Record<AvatarMood, string> = {
  idle: '',
  happy: 'avatar-bounce',
  sad: 'avatar-shake',
  thinking: 'avatar-pulse',
};

export default function Avatar({ items, mood, size = 'large' }: Props) {
  const equipped = items.filter(i => i.equipped);
  const bg = equipped.find(i => i.category === 'background');
  const hat = equipped.find(i => i.category === 'hat');
  const acc = equipped.find(i => i.category === 'accessory');
  const outfit = equipped.find(i => i.category === 'outfit');

  const isSmall = size === 'small';
  const containerSize = isSmall ? 80 : 160;
  const faceSize = isSmall ? 36 : 72;

  return (
    <div
      className={`avatar-container ${MOOD_ANIMATION[mood]}`}
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: '50%',
        background: bg ? 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
        flexShrink: 0,
      }}
    >
      {bg && (
        <div style={{ position: 'absolute', top: 4, right: 4, fontSize: isSmall ? 14 : 20 }}>
          {bg.emoji}
        </div>
      )}
      {hat && (
        <div style={{ fontSize: isSmall ? 18 : 32, lineHeight: 1, marginBottom: -4 }}>
          {hat.emoji}
        </div>
      )}
      <div style={{ fontSize: faceSize, lineHeight: 1 }}>{MOOD_FACE[mood]}</div>
      {outfit && (
        <div style={{ fontSize: isSmall ? 14 : 24, lineHeight: 1 }}>{outfit.emoji}</div>
      )}
      {acc && (
        <div style={{ position: 'absolute', bottom: isSmall ? 6 : 12, right: isSmall ? 6 : 12, fontSize: isSmall ? 12 : 18 }}>
          {acc.emoji}
        </div>
      )}
    </div>
  );
}
