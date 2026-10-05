import React, { useState } from 'react';
import { COUPONS, CouponId, couponById } from '../words/coupons';
import { CouponEvent, TRADE_COST } from '../hooks/useWordProgress';
import { playClick, playPurchase } from '../utils/sounds';

interface Props {
  coupons: Partial<Record<CouponId, number>>;
  history: CouponEvent[];
  onUse: (id: CouponId) => boolean;
  onTrade: (from: CouponId, to: CouponId) => boolean;
  onClose: () => void;
}

export default function CouponWallet({ coupons, history, onUse, onTrade, onClose }: Props) {
  // 교환: 같은 쿠폰 TRADE_COST 장 → 다른 쿠폰 1장
  const [tradeFrom, setTradeFrom] = useState<CouponId | null>(null);
  const [tradeTo, setTradeTo] = useState<CouponId | null>(null);
  const tradable = COUPONS.filter(c => c.tradable);
  const canGive = tradable.filter(c => (coupons[c.id] ?? 0) >= TRADE_COST);

  const doTrade = () => {
    if (!tradeFrom || !tradeTo) return;
    if (onTrade(tradeFrom, tradeTo)) {
      playPurchase();
      setUsedMsg(`${couponById(tradeFrom).name} ${TRADE_COST}장 → ${couponById(tradeTo).name} 1장으로 바꿨어요! 🔄`);
      setTimeout(() => setUsedMsg(null), 2600);
    }
    setTradeFrom(null);
    setTradeTo(null);
  };
  const [confirming, setConfirming] = useState<CouponId | null>(null);
  const [usedMsg, setUsedMsg] = useState<string | null>(null);

  const total = COUPONS.reduce((s, c) => s + (coupons[c.id] ?? 0), 0);

  const doUse = (id: CouponId) => {
    if (onUse(id)) {
      playPurchase();
      setUsedMsg(`${couponById(id).name} 사용! 엄마 아빠에게 보여주세요 🙌`);
      setTimeout(() => setUsedMsg(null), 2600);
    }
    setConfirming(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 160, padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(160deg,#fff7e6,#ffe9f0)',
        borderRadius: 26, padding: 22, maxWidth: 420, width: '100%',
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>🎟️ 내 쿠폰</div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: '50%',
            width: 34, height: 34, fontSize: 17, cursor: 'pointer', fontWeight: 700,
          }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: '#8a7a6a', marginBottom: 16 }}>
          모두 {total}장 있어요. 쓰고 싶은 쿠폰을 눌러보세요!
        </div>

        {usedMsg && (
          <div style={{
            background: 'linear-gradient(135deg,#84fab0,#8fd3f4)', borderRadius: 14,
            padding: '12px 14px', marginBottom: 14, fontSize: 14, fontWeight: 800,
            color: '#1e5c40', textAlign: 'center', animation: 'fadeIn 0.3s ease',
          }}>
            {usedMsg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {COUPONS.map(c => {
            const count = coupons[c.id] ?? 0;
            const has = count > 0;
            return (
              <div key={c.id} style={{
                background: has ? c.color : '#ececec',
                borderRadius: 18, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                opacity: has ? 1 : 0.55,
                boxShadow: has ? '0 4px 14px rgba(0,0,0,0.12)' : 'none',
                // 쿠폰처럼 보이게 가장자리에 점선
                border: '2px dashed rgba(255,255,255,0.8)',
              }}>
                <div style={{ fontSize: 34 }}>{c.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#3b2f4a' }}>{c.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6b5b7a' }}>
                    {has ? `${count}장 있어요` : '아직 없어요'}
                  </div>
                </div>
                <button
                  disabled={!has}
                  onClick={() => { setConfirming(c.id); playClick(); }}
                  style={{
                    padding: '9px 16px', borderRadius: 12, border: 'none',
                    background: has ? '#ffffff' : '#ddd',
                    color: has ? '#7c4dff' : '#999',
                    fontSize: 14, fontWeight: 800,
                    cursor: has ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  }}
                >
                  사용하기
                </button>
              </div>
            );
          })}
        </div>

        {/* 🔄 쿠폰 바꾸기 */}
        <div style={{
          marginTop: 18, background: 'rgba(255,255,255,0.8)', borderRadius: 18, padding: '14px 14px',
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#5b4b8a', marginBottom: 4 }}>
            🔄 쿠폰 바꾸기
          </div>
          <div style={{ fontSize: 12, color: '#8a7a9a', marginBottom: 10 }}>
            같은 쿠폰 {TRADE_COST}장을 다른 쿠폰 1장으로 바꿀 수 있어요 (500원 쿠폰은 빼고)
          </div>
          {canGive.length === 0 ? (
            <div style={{ fontSize: 13, color: '#aaa', fontWeight: 700 }}>
              같은 쿠폰이 {TRADE_COST}장 모이면 바꿀 수 있어요!
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#888', marginBottom: 6 }}>① 낼 쿠폰 ({TRADE_COST}장)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {canGive.map(c => (
                  <button key={c.id}
                    onClick={() => { setTradeFrom(c.id); if (tradeTo === c.id) setTradeTo(null); playClick(); }}
                    style={{
                      padding: '8px 10px', borderRadius: 12, fontFamily: 'inherit', cursor: 'pointer',
                      border: tradeFrom === c.id ? '3px solid #7c4dff' : '2px solid #ddd',
                      background: tradeFrom === c.id ? '#ede7ff' : 'white',
                      fontSize: 13, fontWeight: 800, color: '#4a4463',
                    }}>
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
              {tradeFrom && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#888', marginBottom: 6 }}>② 받을 쿠폰 (1장)</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {tradable.filter(c => c.id !== tradeFrom).map(c => (
                      <button key={c.id}
                        onClick={() => { setTradeTo(c.id); playClick(); }}
                        style={{
                          padding: '8px 10px', borderRadius: 12, fontFamily: 'inherit', cursor: 'pointer',
                          border: tradeTo === c.id ? '3px solid #27ae60' : '2px solid #ddd',
                          background: tradeTo === c.id ? '#e8fff0' : 'white',
                          fontSize: 13, fontWeight: 800, color: '#4a4463',
                        }}>
                        {c.emoji} {c.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button
                disabled={!tradeFrom || !tradeTo}
                onClick={doTrade}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                  background: tradeFrom && tradeTo ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#ddd',
                  color: 'white', fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
                  cursor: tradeFrom && tradeTo ? 'pointer' : 'not-allowed',
                }}>
                {tradeFrom && tradeTo
                  ? `${couponById(tradeFrom).emoji}×${TRADE_COST} → ${couponById(tradeTo).emoji}×1 바꾸기`
                  : '바꿀 쿠폰을 골라주세요'}
              </button>
            </>
          )}
        </div>

        {history.length > 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#8a7a6a', margin: '18px 0 8px' }}>
              📒 최근 기록
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.slice(0, 8).map((h, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.7)', borderRadius: 10,
                  padding: '8px 12px', fontSize: 13, fontWeight: 700,
                  color: h.type === 'earn' ? '#27ae60' : h.type === 'trade' ? '#7c4dff' : '#e67e22',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>
                    {h.type === 'trade' && h.from
                      ? `🔄 ${couponById(h.from).name} ${TRADE_COST}장 → ${couponById(h.id).name}`
                      : `${couponById(h.id).emoji} ${couponById(h.id).name} ${h.type === 'earn' ? '받음' : '사용'}`}
                  </span>
                  <span style={{ color: '#aaa', fontWeight: 600 }}>{h.at}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 사용 확인 */}
        {confirming && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 170, padding: 20,
          }}>
            <div style={{
              background: 'white', borderRadius: 22, padding: '26px 22px',
              maxWidth: 320, width: '100%', textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
              <div style={{ fontSize: 46, marginBottom: 8 }}>{couponById(confirming).emoji}</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
                {couponById(confirming).name}
              </div>
              <div style={{ fontSize: 14, color: '#888', marginBottom: 18, lineHeight: 1.5 }}>
                지금 사용할까요?<br />한 번 쓰면 쿠폰이 없어져요.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setConfirming(null); playClick(); }}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12,
                    border: '2px solid #ccc', background: 'white', color: '#777',
                    fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  아니요
                </button>
                <button
                  onClick={() => doUse(confirming)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
                    fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  네, 쓸래요!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
