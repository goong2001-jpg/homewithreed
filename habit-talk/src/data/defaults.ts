import { Friend, Profile, Slot } from '../types';

/**
 * 기본 친구 4명. 설정에서 이름·이모지·색·말투를 전부 바꿀 수 있고,
 * 추가·삭제도 된다. 어느 친구가 보낼지는 schedule.ts 가 매번 새로 뽑는다.
 */
export const DEFAULT_FRIENDS: Friend[] = [
  { id: 'f-byeol', name: '별이', emoji: '⭐', color: '#ffd465', tone: 'cheer' },
  { id: 'f-toto', name: '토토', emoji: '🐰', color: '#ffb3c6', tone: 'funny' },
  { id: 'f-bangul', name: '방울', emoji: '🐣', color: '#9fe0b0', tone: 'calm' },
  { id: 'f-haneul', name: '하늘', emoji: '🐳', color: '#a8c0e8', tone: 'cheer' },
];

/** 프로필 기본값 — 설정 첫 진입 때 부모가 이름을 바꾼다 */
export const DEFAULT_PROFILE: Profile = {
  childName: '구름',
  schoolType: 'school',
};

/**
 * 기본 시간표. 부모가 시각·문항을 자유롭게 고칠 수 있다.
 * 08:00 의 "학교 갈 준비"는 프로필의 schoolType 에 따라
 * scripts.ts 에서 "어린이집 갈 준비"로 바뀐다.
 */
export const DEFAULT_SLOTS: Slot[] = [
  {
    id: 's-morning',
    time: '07:30',
    title: '아침',
    enabled: true,
    items: [{ id: 'i-wake', ask: '일어났어?', done: '일어났어!' }],
  },
  {
    id: 's-ready',
    time: '08:00',
    title: '등원 준비',
    enabled: true,
    items: [
      { id: 'i-teeth-m', ask: '양치했어?', done: '양치했어!' },
      { id: 'i-breakfast', ask: '아침밥 먹었어?', done: '아침 먹었어!' },
      { id: 'i-bag', ask: '{{school}} 갈 준비 다 했어?', done: '준비 다 했어!' },
    ],
  },
  {
    id: 's-lunch',
    time: '12:00',
    title: '점심',
    enabled: true,
    items: [
      { id: 'i-lunch', ask: '점심 먹었어?', done: '점심 먹었어!' },
      { id: 'i-teeth-l', ask: '점심 먹고 양치했어?', done: '양치했어!' },
    ],
  },
  {
    id: 's-evening',
    time: '17:00',
    title: '집에 와서',
    enabled: true,
    items: [
      { id: 'i-hands', ask: '집에 와서 손 씻었어?', done: '손 씻었어!' },
      { id: 'i-homework', ask: '숙제는 끝냈어?', done: '숙제 끝냈어!' },
      { id: 'i-dinner', ask: '밥은 먹었어?', done: '밥 먹었어!' },
    ],
  },
];

/** 친구 프로필 색 고를 때 쓰는 팔레트 */
export const FRIEND_COLORS = [
  '#ffd465', '#ffb3c6', '#9fe0b0', '#a8c0e8',
  '#d3b8f0', '#ffc999', '#8fd8d8', '#f2a1a1',
];

/** 친구 이모지 고를 때 쓰는 목록 */
export const FRIEND_EMOJIS = [
  '⭐', '🐰', '🐣', '🐳', '🐻', '🦊', '🐼', '🐸',
  '🐨', '🦁', '🐯', '🐷', '🐥', '🦄', '🐢', '🐙',
];
