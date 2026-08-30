import React from 'react';
import { AppState, Friend, Message } from '../types';
import { dateKey, nextSlot } from '../schedule';

/** 목록에 뜨는 시각 — 오늘은 "오후 5:12", 어제는 "어제", 그 전은 날짜 */
function listTime(at: number, now: Date): string {
  const d = new Date(at);
  if (dateKey(d) === dateKey(now)) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${ampm} ${h12}:${m}`;
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dateKey(d) === dateKey(yesterday)) return '어제';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

interface Props {
  state: AppState;
  now: Date;
  onOpen: (friendId: string) => void;
}

export default function FriendListView({ state, now, onOpen }: Props) {
  const today = dateKey(now);
  const stars = state.logs.find((l) => l.date === today)?.stars ?? 0;
  const next = nextSlot(state, now);

  // 친구별 마지막 메시지를 뽑아서, 최근 대화가 위로 오게 정렬한다
  const last = new Map<string, Message>();
  for (const m of state.messages) {
    const prev = last.get(m.friendId);
    if (!prev || m.at >= prev.at) last.set(m.friendId, m);
  }

  const rows = state.friends
    .map((friend: Friend) => {
      const msg = last.get(friend.id);
      const readAt = state.lastRead[friend.id] ?? 0;
      const unread = state.messages.filter(
        (m) => m.friendId === friend.id && m.from === 'friend' && m.at > readAt
      ).length;
      return { friend, msg, unread };
    })
    .sort((a, b) => (b.msg?.at ?? 0) - (a.msg?.at ?? 0));

  return (
    <div className="scroll friend-list">
      <div className="stars-bar">
        <span>⭐</span>
        <span className="count">{stars}</span>
        <span>오늘 모은 별</span>
        {next && (
          <span className="next">
            다음 {next.slot.time} {next.slot.title}
          </span>
        )}
      </div>

      {rows.map(({ friend, msg, unread }) => (
        <button key={friend.id} className="friend-row" onClick={() => onOpen(friend.id)}>
          <div className="avatar" style={{ background: friend.color }}>
            {friend.emoji}
          </div>
          <div className="body">
            <div className="name">{friend.name}</div>
            <div className="preview">
              {msg
                ? `${msg.from === 'me' ? '나: ' : ''}${msg.text}`
                : '아직 대화가 없어요'}
            </div>
          </div>
          <div className="meta">
            {msg && <div className="time">{listTime(msg.at, now)}</div>}
            {unread > 0 && <div className="badge">{unread}</div>}
          </div>
        </button>
      ))}

      {state.messages.length === 0 && (
        <div className="empty-hint" style={{ color: '#8a8a8a' }}>
          아직 온 메시지가 없어요.
          <br />
          {next
            ? `${next.slot.time}에 친구가 먼저 말을 걸 거예요!`
            : '설정에서 시간표를 켜주세요.'}
        </div>
      )}
    </div>
  );
}
