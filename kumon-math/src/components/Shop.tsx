import React, { useState } from 'react';
import { AvatarItem } from '../types';
import Avatar from './Avatar';
import { playPurchase, playClick } from '../utils/sounds';

interface Props {
  items: AvatarItem[];
  points: number;
  totalCorrect: number;
  onBuy: (id: string) => void;
  onEquip: (id: string) => void;
  onClose: () => void;
}

const CATEGORIES: { key: AvatarItem['category']; label: string; emoji: string }[] = [
  { key: 'special', label: '전설', emoji: '🧚' },
  { key: 'hat', label: '모자', emoji: '🎩' },
  { key: 'accessory', label: '장식', emoji: '💎' },
  { key: 'outfit', label: '옷', emoji: '👗' },
  { key: 'background', label: '배경', emoji: '🌈' },
];

export default function Shop({ items, points, totalCorrect, onBuy, onEquip, onClose }: Props) {
  const [tab, setTab] = useState<AvatarItem['category']>('special');
  const [bought, setBought] = useState<string | null>(null);

  const filtered = items.filter(i => i.category === tab);

  const isLocked = (item: AvatarItem) => !item.owned && item.unlockAt != null && totalCorrect < item.unlockAt;

  const handleBuy = (item: AvatarItem) => {
    if (item.owned || points < item.price || isLocked(item)) return;
    onBuy(item.id);
    playPurchase();
    setBought(item.id);
    setTimeout(() => setBought(null), 1200);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #ffecd2, #fcb69f)',
        borderRadius: 28, padding: 24, maxWidth: 480, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>🛍️ 꾸미기 상점</div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, fontSize: 18, cursor: 'pointer', fontWeight: 700,
          }}>✕</button>
        </div>

        {/* 내 아바타 미리보기 */}
        <div style={{
          background: 'white', borderRadius: 16, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18,
        }}>
          <Avatar items={items} mood="idle" size="small" />
          <div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>내 아바타</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f39c12' }}>⭐ {points} 포인트</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>문제 3개 맞추면 ⭐1개!</div>
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => { setTab(c.key); playClick(); }}
              style={{
                flex: 1, minWidth: 70, padding: '8px 4px', borderRadius: 12, border: 'none',
                background: tab === c.key ? '#764ba2' : 'white',
                color: tab === c.key ? 'white' : '#555',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: tab === c.key ? '0 4px 12px rgba(118,75,162,0.4)' : '0 2px 6px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
              }}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* 전설 컬렉션 안내 배너 */}
        {tab === 'special' && (
          <div style={{
            background: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)',
            borderRadius: 14, padding: '12px 14px', marginBottom: 14,
            fontSize: 13, fontWeight: 700, color: '#5b3a7a', lineHeight: 1.5,
          }}>
            🧚 문제를 풀수록 한 조각씩 열려요!<br />
            지금까지 푼 정답: <span style={{ color: '#e74c3c' }}>{totalCorrect}개</span>
            {' · '}모두 모으면 <b>✨다이아 요정✨</b> 완성!
          </div>
        )}

        {/* 아이템 목록 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {filtered.map(item => {
            const canAfford = points >= item.price;
            const locked = isLocked(item);
            const remaining = item.unlockAt ? item.unlockAt - totalCorrect : 0;
            return (
              <div
                key={item.id}
                style={{
                  background: item.equipped
                    ? 'linear-gradient(135deg, #84fab0, #8fd3f4)'
                    : locked ? '#eceaf3' : 'white',
                  borderRadius: 16, padding: 14, textAlign: 'center',
                  border: item.equipped ? '3px solid #27ae60'
                    : item.fullImage ? '3px solid #f5b301' : '2px solid transparent',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  opacity: locked ? 0.7 : (!item.owned && !canAfford ? 0.55 : 1),
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 38, marginBottom: 6, filter: locked ? 'grayscale(1)' : 'none' }}>
                  {locked ? '🔒' : (bought === item.id ? '🎉' : item.emoji)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{item.name}</div>
                {locked ? (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9b59b6', lineHeight: 1.3 }}>
                    문제 {remaining}개 더 풀면<br />열려요! 💪
                  </div>
                ) : item.owned ? (
                  <button
                    onClick={() => { onEquip(item.id); playClick(); }}
                    style={{
                      padding: '6px 14px', borderRadius: 10, border: 'none',
                      background: item.equipped ? '#e74c3c' : '#27ae60',
                      color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {item.equipped ? '벗기' : '입히기'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleBuy(item)}
                    disabled={!canAfford}
                    style={{
                      padding: '6px 14px', borderRadius: 10, border: 'none',
                      background: canAfford ? '#f39c12' : '#ccc',
                      color: 'white', fontSize: 13, fontWeight: 700,
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                    }}
                  >
                    ⭐ {item.price}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
