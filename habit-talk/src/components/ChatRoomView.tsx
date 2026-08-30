import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, CheckItem, Friend, Message } from '../types';
import { dateKey } from '../schedule';
import { itemAsk } from '../chat/scripts';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function bubbleTime(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${m}`;
}

function dayLabel(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

/** 아이가 타이핑을 못/안 할 때 누를 수 있는 버튼들 */
const QUICK_REPLIES = ['응!', '아직...', '조금 있다 할게', '나 지금 바빠', '뭐해?', '심심해'];

interface Props {
  state: AppState;
  friend: Friend;
  typing: boolean;
  onSend: (text: string) => void;
  onCheck: (messageId: string, item: CheckItem) => void;
}

export default function ChatRoomView({ state, friend, typing, onSend, onCheck }: Props) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => state.messages.filter((m) => m.friendId === friend.id).sort((a, b) => a.at - b.at),
    [state.messages, friend.id]
  );

  // 새 말풍선이 오거나 친구가 입력 중이면 맨 아래로 따라 내려간다
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, typing]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setDraft('');
  };

  const itemById = (id: string): CheckItem | undefined => {
    for (const slot of state.slots) {
      const found = slot.items.find((i) => i.id === id);
      if (found) return found;
    }
    return undefined;
  };

  let lastDay = '';

  return (
    <>
      <div className="scroll chat chat-scroll">
        {messages.length === 0 && (
          <div className="empty-hint">
            아직 {friend.name}와 나눈 대화가 없어요.
            <br />
            먼저 말을 걸어봐도 좋아요!
          </div>
        )}

        {messages.map((msg: Message) => {
          const day = dateKey(new Date(msg.at));
          const showDay = day !== lastDay;
          lastDay = day;

          return (
            <React.Fragment key={msg.id}>
              {showDay && (
                <div className="day-divider">
                  <span>{dayLabel(msg.at)}</span>
                </div>
              )}

              <div className={`msg-row ${msg.from === 'me' ? 'me' : ''}`}>
                {msg.from === 'friend' && (
                  <div className="avatar sm" style={{ background: friend.color }}>
                    {friend.emoji}
                  </div>
                )}
                <div className="msg-col">
                  {msg.from === 'friend' && <div className="msg-name">{friend.name}</div>}
                  <div className="bubble-wrap">
                    {msg.kind === 'checklist' ? (
                      <div className="bubble checklist">
                        {msg.text}
                        {(state.slots.find((s) => s.id === msg.slotId)?.items ?? []).map((item) => {
                          const done = !(msg.pending ?? []).includes(item.id);
                          return (
                            <button
                              key={item.id}
                              className={`check-item ${done ? 'done' : ''}`}
                              disabled={done}
                              onClick={() => onCheck(msg.id, item)}
                            >
                              <span className="check-box">{done ? '✓' : ''}</span>
                              <span>
                                {itemAsk(itemById(item.id) ?? item, {
                                  friend,
                                  profile: state.profile,
                                })}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bubble">{msg.text}</div>
                    )}
                    <span className="bubble-time">{bubbleTime(msg.at)}</span>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {typing && <div className="typing">{friend.name}님이 입력 중…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="composer">
        <div className="quick-replies">
          {QUICK_REPLIES.map((q) => (
            <button key={q} onClick={() => submit(q)}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="composer-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`${friend.name}에게 보내기`}
            aria-label="메시지 입력"
            enterKeyHint="send"
          />
          <button type="submit" className="send-btn" disabled={draft.trim().length === 0}>
            전송
          </button>
        </form>
      </div>
    </>
  );
}
