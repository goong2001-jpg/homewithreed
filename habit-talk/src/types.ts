/** 친구 캐릭터. 이름·이모지·색은 설정에서 부모가 바꿀 수 있다. */
export interface Friend {
  id: string;
  name: string;
  emoji: string;
  /** 프로필 원형 배경색 */
  color: string;
  /** 말투. 같은 내용이라도 어미가 달라진다 */
  tone: Tone;
}

/** 말투 종류 — chat/scripts.ts 의 어미 변환에 쓰인다 */
export type Tone = 'cheer' | 'calm' | 'funny';

/** 체크리스트 한 줄. "양치했어?" 처럼 물어보고, 아이가 탭하면 완료 처리된다 */
export interface CheckItem {
  id: string;
  /** 친구가 물어보는 말 — "양치했어?" */
  ask: string;
  /** 아이가 탭했을 때 아이 말풍선에 뜨는 말 — "양치했어!" */
  done: string;
}

/** 시간대 하나. 07:30 · 08:00 · 12:00 · 17:00 */
export interface Slot {
  id: string;
  /** "HH:MM" 24시간제 */
  time: string;
  /** 알림 제목 겸 대화 머리말 — "아침" */
  title: string;
  items: CheckItem[];
  enabled: boolean;
}

export interface Profile {
  childName: string;
  /** 08:00 문항이 "어린이집 갈 준비"인지 "학교 갈 준비"인지 가른다 */
  schoolType: 'daycare' | 'school';
}

export type MessageKind = 'text' | 'checklist' | 'sticker';

/** 말풍선 하나 */
export interface Message {
  id: string;
  /** 어느 친구의 채팅방인지 */
  friendId: string;
  from: 'friend' | 'me';
  kind: MessageKind;
  text: string;
  /** 보낸 시각(ms). 밀린 메시지는 원래 예정 시각으로 들어가 카톡처럼 보인다 */
  at: number;
  /** kind === 'checklist' 일 때, 어느 슬롯의 체크리스트인지 */
  slotId?: string;
  /** kind === 'checklist' 일 때, 아직 안 누른 항목 id들 */
  pending?: string[];
}

/** 하루치 체크 기록. date 는 "YYYY-MM-DD" */
export interface DayLog {
  date: string;
  /** slotId → itemId → 완료 여부 */
  done: Record<string, Record<string, boolean>>;
  /** 그날 모은 별 개수 */
  stars: number;
}

/**
 * Worker 에 올리는 설정. "언제 무슨 알림을 쏠지"를 미리 계산해 두지 않고
 * 규칙만 올린다 — 앱을 2주 안 열어도 알림은 계속 온다.
 * 발신 친구와 문구는 Worker 가 발송 순간에 무작위로 고른다.
 */
export interface PushConfig {
  deviceId: string;
  /** "Asia/Seoul" 같은 IANA 타임존. Worker 가 이걸로 현지 시각을 계산한다 */
  timezone: string;
  /** 알림을 보낼 친구 후보. id 도 같이 올려야 앱이 '누가 보냈는지' 맞출 수 있다 */
  friends: { id: string; name: string; emoji: string }[];
  slots: PushSlotConfig[];
}

export interface PushSlotConfig {
  id: string;
  /** "HH:MM" 현지 시각 */
  time: string;
  title: string;
  /** 알림 본문 후보. 아이 이름까지 다 채워 넣은 완성 문장들 */
  bodies: string[];
}

/** localStorage 에 통째로 담기는 앱 상태 */
export interface AppState {
  version: number;
  profile: Profile;
  friends: Friend[];
  slots: Slot[];
  messages: Message[];
  logs: DayLog[];
  /** 친구별 마지막으로 읽은 시각(ms) — 안 읽은 뱃지 계산용 */
  lastRead: Record<string, number>;
  /** 이미 채팅방에 풀어놓은 슬롯 — "YYYY-MM-DD|slotId" 집합 */
  delivered: string[];
  push: PushState;
}

export interface PushState {
  enabled: boolean;
  /** 이 기기를 구분하는 id */
  deviceId: string;
  /** 부모가 설정에서 한 번 입력하는 암호. Worker 가 이걸로 아무나 쓰는 걸 막는다 */
  passphrase: string;
  /** 마지막으로 올린 설정의 지문. 같으면 다시 안 올린다 (KV 쓰기 한도 아끼기) */
  syncedHash: string;
  /** 마지막으로 성공한 구독의 endpoint. 바뀌면 다시 올린다 */
  endpoint: string;
}

export const STORAGE_KEY = 'habit-talk:state';
/** 저장 형식 버전. 구조가 바뀌면 올리고 storage.ts 에서 마이그레이션한다 */
export const STATE_VERSION = 1;
