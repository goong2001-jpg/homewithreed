import React, { useRef, useState } from 'react';
import { AppState, CheckItem, Friend, Slot } from '../types';
import { FRIEND_COLORS, FRIEND_EMOJIS } from '../data/defaults';
import {
  needsInstallFirst,
  platform,
  pushConfigured,
  pushSupported,
} from '../push/register';
import { downloadBackup, parseBackup } from '../utils/backup';

interface Props {
  state: AppState;
  pushBusy: boolean;
  pushError: string;
  onChange: (next: AppState) => void;
  onTogglePush: (on: boolean) => void;
  onTestSlot: (slotId: string) => void;
  onReset: () => void;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export default function SettingsView({
  state,
  pushBusy,
  pushError,
  onChange,
  onTogglePush,
  onTestSlot,
  onReset,
}: Props) {
  const [editingFriend, setEditingFriend] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (over: Partial<AppState>) => onChange({ ...state, ...over });

  const updateFriend = (id: string, over: Partial<Friend>) =>
    patch({ friends: state.friends.map((f) => (f.id === id ? { ...f, ...over } : f)) });

  const updateSlot = (id: string, over: Partial<Slot>) =>
    patch({ slots: state.slots.map((s) => (s.id === id ? { ...s, ...over } : s)) });

  const updateItem = (slotId: string, itemId: string, over: Partial<CheckItem>) =>
    patch({
      slots: state.slots.map((s) =>
        s.id === slotId
          ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, ...over } : i)) }
          : s
      ),
    });

  const canPush = pushConfigured() && pushSupported();
  const mustInstall = needsInstallFirst();

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const result = parseBackup(text, state);
    if (!result.ok || !result.state) {
      setImportMsg(result.reason ?? '불러오지 못했어요.');
      return;
    }
    onChange(result.state);
    setImportMsg('백업을 불러왔어요.');
  };

  return (
    <div className="scroll settings">
      <div className="settings-inner">
        {/* ── 백업: 데이터를 지키는 유일한 방법이라 맨 위에 둔다 ── */}
        <div className="card">
          <h2>💾 백업</h2>
          <p className="desc">
            이 앱은 서버에 아무것도 저장하지 않아요. 폰을 바꾸거나 브라우저 데이터를 지우면
            설정과 대화가 사라집니다. 가끔 내보내서 보관해 주세요.
            {platform() === 'ios' && (
              <>
                <br />
                아이폰에서 사파리 → 홈 화면 앱으로 설정을 옮길 때도 이 파일을 씁니다.
              </>
            )}
          </p>
          <div className="btn-row">
            <button className="btn" onClick={() => downloadBackup(state)}>
              내보내기
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              불러오기
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = '';
              }}
            />
          </div>
          {importMsg && <div className="notice ok">{importMsg}</div>}
        </div>

        {/* ── 아이 정보 ── */}
        <div className="card">
          <h2>🧒 아이</h2>
          <div className="field">
            <label htmlFor="childName">이름 (친구들이 부르는 이름)</label>
            <input
              id="childName"
              value={state.profile.childName}
              onChange={(e) =>
                patch({ profile: { ...state.profile, childName: e.target.value } })
              }
              placeholder="구름"
            />
          </div>
          <div className="field">
            <label htmlFor="schoolType">어디에 다니나요</label>
            <select
              id="schoolType"
              value={state.profile.schoolType}
              onChange={(e) =>
                patch({
                  profile: {
                    ...state.profile,
                    schoolType: e.target.value as 'daycare' | 'school',
                  },
                })
              }
            >
              <option value="daycare">어린이집 / 유치원</option>
              <option value="school">학교</option>
            </select>
          </div>
        </div>

        {/* ── 알림 ── */}
        <div className="card">
          <h2>🔔 알림</h2>
          <p className="desc">
            켜두면 앱이 꺼져 있어도 정해진 시간에 폰 알림이 옵니다. 보내는 친구는 그때그때
            무작위로 정해져요.
          </p>

          <div className="toggle">
            <div>
              <div className="label">푸시 알림</div>
              <div className="hint">
                {!pushConfigured()
                  ? '이 빌드에는 알림 서버가 연결돼 있지 않아요. 앱을 열면 밀린 메시지는 그대로 볼 수 있어요.'
                  : mustInstall
                  ? '아이폰은 먼저 홈 화면에 추가하고, 그 앱 안에서 켜주세요.'
                  : state.push.enabled
                  ? '켜져 있어요.'
                  : '꺼져 있어요.'}
              </div>
            </div>
            <button
              className={`switch ${state.push.enabled ? 'on' : ''}`}
              disabled={!canPush || mustInstall || pushBusy}
              aria-label="푸시 알림 켜기"
              onClick={() => onTogglePush(!state.push.enabled)}
            />
          </div>

          {pushConfigured() && (
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="passphrase">알림 암호 (부모가 정한 값)</label>
              <input
                id="passphrase"
                value={state.push.passphrase}
                onChange={(e) =>
                  patch({ push: { ...state.push, passphrase: e.target.value, syncedHash: '' } })
                }
                placeholder="알림 서버에 등록한 암호"
                autoComplete="off"
              />
            </div>
          )}

          {pushError && <div className="notice error">{pushError}</div>}
        </div>

        {/* ── 시간표 ── */}
        <div className="card">
          <h2>⏰ 시간표</h2>
          <p className="desc">
            시각과 물어볼 내용을 자유롭게 바꿀 수 있어요. 끄면 그 시간대는 오지 않아요.
          </p>

          {state.slots.map((slot) => (
            <div key={slot.id} className="slot-card">
              <div className="slot-head">
                <input
                  type="time"
                  value={slot.time}
                  aria-label="시각"
                  onChange={(e) => updateSlot(slot.id, { time: e.target.value })}
                />
                <input
                  type="text"
                  value={slot.title}
                  aria-label="이름"
                  onChange={(e) => updateSlot(slot.id, { title: e.target.value })}
                />
                <button
                  className={`switch ${slot.enabled ? 'on' : ''}`}
                  aria-label={`${slot.title} 켜기`}
                  onClick={() => updateSlot(slot.id, { enabled: !slot.enabled })}
                />
              </div>

              {slot.items.map((item) => (
                <div key={item.id} className="item-row">
                  <input
                    value={item.ask}
                    aria-label="물어볼 말"
                    onChange={(e) => updateItem(slot.id, item.id, { ask: e.target.value })}
                  />
                  <button
                    className="icon-btn"
                    aria-label="항목 삭제"
                    onClick={() =>
                      updateSlot(slot.id, { items: slot.items.filter((i) => i.id !== item.id) })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div className="btn-row" style={{ marginTop: 8 }}>
                <button
                  className="btn"
                  onClick={() =>
                    updateSlot(slot.id, {
                      items: [
                        ...slot.items,
                        { id: newId('i'), ask: '새로운 할 일 했어?', done: '했어!' },
                      ],
                    })
                  }
                >
                  + 항목
                </button>
                <button className="btn" onClick={() => onTestSlot(slot.id)}>
                  지금 보내보기
                </button>
                {state.slots.length > 1 && (
                  <button
                    className="btn danger"
                    onClick={() => patch({ slots: state.slots.filter((s) => s.id !== slot.id) })}
                  >
                    시간대 삭제
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            className="btn wide"
            onClick={() =>
              patch({
                slots: [
                  ...state.slots,
                  {
                    id: newId('s'),
                    time: '20:00',
                    title: '새 시간대',
                    enabled: true,
                    items: [{ id: newId('i'), ask: '오늘 하루 어땠어?', done: '좋았어!' }],
                  },
                ],
              })
            }
          >
            + 시간대 추가
          </button>
        </div>

        {/* ── 친구 ── */}
        <div className="card">
          <h2>👦 친구</h2>
          <p className="desc">
            이름·이모지·말투를 바꿀 수 있어요. 메시지를 보낼 친구는 매번 이 중에서 무작위로
            정해집니다.
          </p>

          {state.friends.map((friend) => (
            <div key={friend.id} className="slot-card">
              <div className="row">
                <div className="avatar sm" style={{ background: friend.color }}>
                  {friend.emoji}
                </div>
                <input
                  className="grow"
                  value={friend.name}
                  aria-label="친구 이름"
                  onChange={(e) => updateFriend(friend.id, { name: e.target.value })}
                />
                <button
                  className="icon-btn"
                  aria-label="꾸미기"
                  onClick={() =>
                    setEditingFriend(editingFriend === friend.id ? null : friend.id)
                  }
                >
                  🎨
                </button>
                {state.friends.length > 1 && (
                  <button
                    className="icon-btn"
                    aria-label="친구 삭제"
                    onClick={() =>
                      patch({ friends: state.friends.filter((f) => f.id !== friend.id) })
                    }
                  >
                    ✕
                  </button>
                )}
              </div>

              {editingFriend === friend.id && (
                <>
                  <div className="field" style={{ marginTop: 10 }}>
                    <label>말투</label>
                    <select
                      value={friend.tone}
                      onChange={(e) =>
                        updateFriend(friend.id, { tone: e.target.value as Friend['tone'] })
                      }
                    >
                      <option value="cheer">밝고 씩씩하게</option>
                      <option value="calm">차분하고 다정하게</option>
                      <option value="funny">장난스럽게</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>이모지</label>
                    <div className="chips">
                      {FRIEND_EMOJIS.map((e) => (
                        <button
                          key={e}
                          className={`chip ${friend.emoji === e ? 'sel' : ''}`}
                          onClick={() => updateFriend(friend.id, { emoji: e })}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label>색</label>
                    <div className="chips">
                      {FRIEND_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`chip color ${friend.color === c ? 'sel' : ''}`}
                          style={{ background: c }}
                          aria-label={`색 ${c}`}
                          onClick={() => updateFriend(friend.id, { color: c })}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          <button
            className="btn wide"
            onClick={() =>
              patch({
                friends: [
                  ...state.friends,
                  {
                    id: newId('f'),
                    name: '새 친구',
                    emoji: FRIEND_EMOJIS[state.friends.length % FRIEND_EMOJIS.length],
                    color: FRIEND_COLORS[state.friends.length % FRIEND_COLORS.length],
                    tone: 'cheer',
                  },
                ],
              })
            }
          >
            + 친구 추가
          </button>
        </div>

        {/* ── 초기화 ── */}
        <div className="card">
          <h2>🧹 초기화</h2>
          <p className="desc">대화와 기록, 설정을 모두 지우고 처음 상태로 되돌립니다.</p>
          <button
            className="btn danger wide"
            onClick={() => {
              if (window.confirm('정말 모두 지울까요? 되돌릴 수 없어요.')) onReset();
            }}
          >
            전체 초기화
          </button>
        </div>
      </div>
    </div>
  );
}
