import React, { useMemo, useState } from 'react';
import {
  GIFT_KIND_EMOJI, GIFT_KINDS, GiftDirection, GiftEntry, GiftKind, Person, SyncStatus,
} from '../types';
import {
  counterpartyTotals, filterGifts, giftTotalsByPerson, giftYears,
  groupGiftsByMonth, summarizeGifts,
} from '../utils/gifts';
import { dateLabel, monthLabel, won } from '../utils/format';

interface Props {
  gifts: GiftEntry[];
  persons: Person[];
  syncStatus: SyncStatus;
  onAdd: (direction: GiftDirection) => void;
  onEdit: (entry: GiftEntry) => void;
  onGoSettings: () => void;
}

type Mode = 'list' | 'people';

/**
 * 경조사 · 용돈 장부.
 *
 * 달 단위가 아니라 **연도 단위**로 본다 — 몇 년 전 축의금을 찾는 게 쓸모라서
 * 다른 화면처럼 이번 달만 보여주면 아무 의미가 없다.
 */
export default function GiftsView({
  gifts, persons, syncStatus, onAdd, onEdit, onGoSettings,
}: Props) {
  const [year, setYear] = useState<string>('');          // '' = 전체
  const [direction, setDirection] = useState<GiftDirection | ''>('');
  const [kind, setKind] = useState<GiftKind | ''>('');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<Mode>('list');

  const years = useMemo(() => giftYears(gifts), [gifts]);

  const rows = useMemo(
    () => filterGifts(gifts, {
      year: year || undefined,
      direction: direction || undefined,
      kind: kind || undefined,
      q: q || undefined,
    }),
    [gifts, year, direction, kind, q],
  );

  const sum = useMemo(() => summarizeGifts(rows), [rows]);
  const people = useMemo(() => counterpartyTotals(rows), [rows]);
  const perPerson = useMemo(() => giftTotalsByPerson(rows), [rows]);
  const groups = useMemo(() => groupGiftsByMonth(rows), [rows]);

  const personOf = (id: string) => persons.find(p => p.id === id);
  const sortedPersons = [...persons].sort((a, b) => a.order - b.order);
  const filtering = !!(year || direction || kind || q);
  const empty = gifts.filter(g => !g.deleted).length === 0;

  const chip = (on: boolean, color: string): React.CSSProperties => ({
    padding: '7px 13px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer',
    border: `1.5px solid ${on ? color : '#E5E8EB'}`,
    background: on ? `${color}14` : '#fff',
    color: on ? color : '#4E5968',
    fontWeight: on ? 700 : 400,
    whiteSpace: 'nowrap',
  });

  const modeTab = (m: Mode): React.CSSProperties => ({
    flex: 1, padding: '8px 0', borderRadius: 12, cursor: 'pointer', fontSize: 13,
    border: 'none',
    background: mode === m ? '#fff' : 'transparent',
    color: mode === m ? '#333D4B' : '#8B95A1',
    fontWeight: mode === m ? 700 : 500,
    boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
  });

  return (
    <>
      {/* 다른 탭과 달리 달 이동이 없다 — 연도로 본다 */}
      <div style={{
        background: '#fff', padding: '13px 16px', boxShadow: 'none', borderBottom: '1px solid #F2F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#191F28' }}>
          경조사 · 용돈
        </h2>
        <button
          onClick={onGoSettings}
          style={{
            fontSize: 11, padding: '5px 9px', border: 'none', borderRadius: 20,
            background: '#F2F4F6', color: '#8B95A1', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {syncStatus === 'live' ? '● 같이 보는 중' : '● 이 기기에만 저장'}
        </button>
      </div>

      {empty ? (
        <div style={{ textAlign: 'center', padding: '54px 24px', color: '#B0B8C1' }}>
          <div style={{ fontSize: 46, marginBottom: 14 }}>🧧</div>
          <div style={{ fontSize: 15, color: '#8B95A1', fontWeight: 600, marginBottom: 8 }}>
            아직 기록이 없어요
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 22 }}>
            아이들이 받은 용돈, 우리가 낸 축의금·부의금을
            <br />여기에 적어두면 몇 년이 지나도 찾아볼 수 있어요.
            <br />
            <span style={{ fontSize: 12, color: '#D1D6DB' }}>
              낸 돈은 쓴 돈으로 쳐서 저금통에서 빠지고, 받은 돈은 장부에만 남아요.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <button
              onClick={() => onAdd('in')}
              style={{
                flex: 1, padding: 14, background: '#12B76A', color: '#fff', border: 'none',
                borderRadius: 14, fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              받은 돈 적기
            </button>
            <button
              onClick={() => onAdd('out')}
              style={{
                flex: 1, padding: 14, background: '#fff', color: '#F04452',
                border: '1.5px solid #FFD9DD', borderRadius: 14,
                fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              낸 돈 적기
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 연도 */}
          <div style={{ display: 'flex', gap: 7, padding: '12px 16px 4px', overflowX: 'auto' }}>
            <button onClick={() => setYear('')} style={chip(year === '', '#6B7684')}>
              전체
            </button>
            {years.map(y => (
              <button key={y} onClick={() => setYear(y)} style={chip(year === y, '#6B7684')}>
                {y}년
              </button>
            ))}
          </div>

          {/* 받은 돈 / 낸 돈 / 차액 */}
          <div style={{
            background: '#fff', margin: '10px 16px', borderRadius: 20, padding: 16,
            boxShadow: 'none',
          }}>
            <div style={{ display: 'flex' }}>
              <button
                onClick={() => setDirection(direction === 'in' ? '' : 'in')}
                style={{
                  flex: 1, textAlign: 'center', background: 'none', cursor: 'pointer',
                  border: 'none', borderRight: '1px solid #F2F4F6', padding: '2px 0',
                }}
              >
                <div style={{ fontSize: 11, color: '#8B95A1', marginBottom: 4 }}>
                  받은 돈 {direction === 'in' && '▾'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#12B76A' }}>
                  {won(sum.received)}
                </div>
              </button>
              <button
                onClick={() => setDirection(direction === 'out' ? '' : 'out')}
                style={{
                  flex: 1, textAlign: 'center', background: 'none', cursor: 'pointer',
                  border: 'none', borderRight: '1px solid #F2F4F6', padding: '2px 0',
                }}
              >
                <div style={{ fontSize: 11, color: '#8B95A1', marginBottom: 4 }}>
                  낸 돈 {direction === 'out' && '▾'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F04452' }}>
                  {won(sum.given)}
                </div>
              </button>
              <div style={{ flex: 1, textAlign: 'center', padding: '2px 0' }}>
                <div style={{ fontSize: 11, color: '#8B95A1', marginBottom: 4 }}>차액</div>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: sum.net >= 0 ? '#12B76A' : '#F04452',
                }}>
                  {sum.net >= 0 ? '+' : '−'}{won(Math.abs(sum.net))}
                </div>
              </div>
            </div>

            {/* 아이별 받은 용돈 — '하율이가 올해 얼마 받았나' */}
            {sortedPersons.some(p => (perPerson.get(p.id)?.received ?? 0) > 0) && (
              <div style={{
                marginTop: 13, paddingTop: 12, borderTop: '1px solid #F2F4F6',
                display: 'flex', flexWrap: 'wrap', gap: 7,
              }}>
                {sortedPersons.map(p => {
                  const s = perPerson.get(p.id);
                  if (!s || s.received === 0) return null;
                  return (
                    <span
                      key={p.id}
                      style={{
                        fontSize: 11.5, color: p.color, fontWeight: 600,
                        background: `${p.color}12`, borderRadius: 7, padding: '4px 9px',
                      }}
                    >
                      {p.name} 받음 {won(s.received)}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* 이름으로 찾기 — 이 장부의 핵심 기능 */}
          <div style={{ padding: '2px 16px 0', position: 'relative' }}>
            <input
              id="gift-search"
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="이름으로 찾기 (예: 김철수)"
              style={{
                width: '100%', padding: '11px 12px 11px 34px', borderRadius: 14,
                border: '1.5px solid #E5E8EB', fontSize: 14,
                boxSizing: 'border-box', outline: 'none', background: '#fff',
              }}
            />
            <span style={{
              position: 'absolute', left: 27, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: '#B0B8C1', pointerEvents: 'none',
            }}>
              🔍
            </span>
          </div>

          {/* 종류 */}
          <div style={{ display: 'flex', gap: 7, padding: '10px 16px 4px', overflowX: 'auto' }}>
            <button onClick={() => setKind('')} style={chip(kind === '', '#6B7684')}>
              전체 종류
            </button>
            {GIFT_KINDS.map(k => (
              <button key={k} onClick={() => setKind(kind === k ? '' : k)} style={chip(kind === k, '#6B7684')}>
                {GIFT_KIND_EMOJI[k]} {k}
              </button>
            ))}
          </div>

          <div style={{
            display: 'flex', gap: 4, margin: '10px 16px 0', padding: 4,
            background: '#F2F4F6', borderRadius: 14,
          }}>
            <button onClick={() => setMode('list')} style={modeTab('list')}>날짜순</button>
            <button onClick={() => setMode('people')} style={modeTab('people')}>이름별</button>
          </div>

          <div style={{
            padding: '10px 16px 4px', fontSize: 12, color: '#8B95A1',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span>
              {year ? `${year}년` : '전체 기간'} · {rows.length}건
            </span>
            {filtering && (
              <button
                onClick={() => { setYear(''); setDirection(''); setKind(''); setQ(''); }}
                style={{
                  fontSize: 11.5, padding: '4px 10px', border: '1px solid #E5E8EB',
                  borderRadius: 20, background: '#fff', color: '#8B95A1', cursor: 'pointer',
                }}
              >
                조건 지우기
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '44px 20px', color: '#B0B8C1' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 14.5 }}>조건에 맞는 기록이 없어요</div>
            </div>
          ) : mode === 'people' ? (
            <div style={{
              background: '#fff', margin: '4px 16px 12px', borderRadius: 20, overflow: 'hidden',
              boxShadow: 'none',
            }}>
              {people.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => { setQ(c.name); setMode('list'); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 14px', background: 'none', border: 'none',
                    borderTop: i === 0 ? 'none' : '1px solid #F2F4F6',
                    textAlign: 'left', cursor: 'pointer', font: 'inherit',
                  }}
                  aria-label={`${c.name} 내역 보기`}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block', fontSize: 14.5, fontWeight: 600, color: '#191F28',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#8B95A1' }}>
                      {c.count}번 · 마지막 {c.lastDate.replace(/-/g, '.')}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    {c.received > 0 && (
                      <span style={{
                        display: 'block', fontSize: 13, fontWeight: 700, color: '#12B76A',
                      }}>
                        받음 {won(c.received)}
                      </span>
                    )}
                    {c.given > 0 && (
                      <span style={{
                        display: 'block', fontSize: 13, fontWeight: 700, color: '#F04452',
                      }}>
                        냄 {won(c.given)}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: '#D1D6DB', flexShrink: 0 }}>›</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 4 }}>
              {groups.map(([m, items]) => (
                <div key={m}>
                  <div style={{
                    padding: '9px 16px', fontSize: 12, color: '#8B95A1', fontWeight: 600,
                    background: '#F2F4F6', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>{monthLabel(m)}</span>
                    <span>{items.length}건</span>
                  </div>
                  <div style={{ background: '#fff' }}>
                    {items.map(g => {
                      const person = personOf(g.personId);
                      const inbound = g.direction === 'in';
                      return (
                        <button
                          key={g.id}
                          onClick={() => onEdit(g)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                            padding: '12px 16px', background: 'none', border: 'none',
                            borderBottom: '1px solid #F2F4F6',
                            textAlign: 'left', cursor: 'pointer', font: 'inherit',
                          }}
                          aria-label={`${g.counterparty} 수정`}
                        >
                          <span style={{
                            width: 36, height: 36, borderRadius: 14, background: '#F2F4F6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 17, flexShrink: 0,
                          }}>
                            {GIFT_KIND_EMOJI[g.kind]}
                          </span>

                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{
                              display: 'block', fontSize: 14.5, fontWeight: 600, color: '#191F28',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {g.counterparty}
                            </span>
                            <span style={{
                              display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
                              fontSize: 11.5, color: '#8B95A1', marginTop: 2,
                            }}>
                              {person && (
                                <span style={{
                                  color: person.color, fontWeight: 700,
                                  background: `${person.color}14`, borderRadius: 6, padding: '1px 6px',
                                }}>
                                  {person.name}
                                </span>
                              )}
                              <span>{g.kind}</span>
                              <span style={{ color: '#D1D6DB' }}>·</span>
                              <span>{dateLabel(g.date)}</span>
                              {g.memo && (
                                <>
                                  <span style={{ color: '#D1D6DB' }}>·</span>
                                  <span>{g.memo}</span>
                                </>
                              )}
                            </span>
                          </span>

                          <span style={{
                            fontSize: 15, fontWeight: 700, flexShrink: 0,
                            color: inbound ? '#12B76A' : '#F04452',
                          }}>
                            {inbound ? '+' : '−'}{won(g.amount)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 9, margin: '14px 16px 8px' }}>
            <button
              onClick={() => onAdd('in')}
              style={{
                flex: 1, padding: 14, background: '#12B76A', color: '#fff', border: 'none',
                borderRadius: 11, fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              + 받은 돈
            </button>
            <button
              onClick={() => onAdd('out')}
              style={{
                flex: 1, padding: 14, background: '#fff', color: '#F04452',
                border: '1.5px solid #FFD9DD', borderRadius: 11,
                fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              + 낸 돈
            </button>
          </div>

          <div style={{
            fontSize: 11.5, color: '#B0B8C1', textAlign: 'center',
            lineHeight: 1.8, padding: '0 20px 8px',
          }}>
            줄을 누르면 고칠 수 있어요. 낸 돈은 저금통(쓴 돈)에서 빠지고, 받은 돈은 장부에만 남아요.
          </div>
        </>
      )}
    </>
  );
}
