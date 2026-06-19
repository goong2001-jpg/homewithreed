import React, { useState } from 'react';
import { AvatarItem } from '../types';
import Avatar from './Avatar';

interface Props {
  items: AvatarItem[];
  points: number;
  onBuy: (id: string) => void;
  onEquip: (id: string) => void;
  onClose: () => void;
}

const CATEGORIES: { key: AvatarItem['category']; label: string; emoji: string }[] = [
  { key: 'hat', label: '모자', emoji: '🎩' },
  { key: 'accessory', label: '액세서리', emoji: '💎' },
  { key: 'outfit', label: '의상', emoji: '👗' },
  { key: 'background', label: '배경', emoji: '🌈' },
];

export default function Shop({ items, points, onBuy, onEquip, onClose }: Props) {
  const [tab, setTab] = useState<AvatarItem['category']>('hat');
  const [bought, setBought] = useState<string | null>(null);

  const filtered = items.filter(i => i.category === tab);

  const handleBuy = (item: AvatarItem) => {
    if (item.owned || points < item.price) return;
    onBuy(item.id);
    setBought(item.id);
    setTimeout(() => setBought(null), 1000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #ffecd2, #fcb69f)',
        borderRadius: 28, padding: 28, maxWidth: 480, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>🛍️ 꾸미기 상점</div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, fontSize: 18, cursor: 'pointer', fontWeight: 700,
          }}>✕</button>
        </div>

        <div style={{
          background: 'white', borderRadius: 16, padding: 12,
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        }}>
          <Avatar items={items} mood="idle" size="small" />
          <div>
            <div style={{ fontSize: 15, color: '#888' }}>내 아바타</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f39c12' }}>⭐ {points} 포인트</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setTab(c.key)}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {filtered.map(item => (
            <div
              key={item.id}
              style={{
                background: item.equipped ? 'linear-gradient(135deg, #84fab0, #8fd3f4)' : 'white',
                borderRadius: 16, padding: 16, textAlign: 'center',
                border: item.equipped ? '3px solid #27ae60' : '2px solid transparent',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                opacity: !item.owned && points < item.price ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>
                {bought === item.id ? '🎉' : item.emoji}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
              {item.owned ? (
                <button
                  onClick={() => onEquip(item.id)}
                  style={{
                    padding: '6px 16px', borderRadius: 10, border: 'none',
                    background: item.equipped ? '#e74c3c' : '#27ae60',
                    color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {item.equipped ? '해제' : '착용'}
                </button>
              ) : (
                <button
                  onClick={() => handleBuy(item)}
                  disabled={points < item.price}
                  style={{
                    padding: '6px 16px', borderRadius: 10, border: 'none',
                    background: points >= item.price ? '#f39c12' : '#ccc',
                    color: 'white', fontSize: 13, fontWeight: 700,
                    cursor: points >= item.price ? 'pointer' : 'not-allowed',
                  }}
                >
                  ⭐ {item.price}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
