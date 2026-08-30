/**
 * 발송 시각 고르는 로직 테스트.
 *   npm test
 *
 * Worker 전체를 띄우지 않고, 순수 함수만 Node 로 직접 돌린다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { dueJobs, localParts, parseHHMM } from './index.ts';

const device = (over = {}) => ({
  deviceId: 'dev-1',
  subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } },
  updatedAt: 0,
  config: {
    deviceId: 'dev-1',
    timezone: 'Asia/Seoul',
    friends: [{ id: 'f1', name: '별이', emoji: '⭐' }],
    slots: [
      { id: 's-morning', time: '07:30', title: '아침', bodies: ['일어났어?'] },
      { id: 's-lunch', time: '12:00', title: '점심', bodies: ['점심 먹었어?'] },
    ],
    ...over,
  },
});

/** 한국 시간 기준으로 Date 를 만든다 (KST = UTC+9, 서머타임 없음) */
const kst = (y, m, d, h, min) => new Date(Date.UTC(y, m - 1, d, h - 9, min));

test('parseHHMM', () => {
  assert.equal(parseHHMM('07:30'), 450);
  assert.equal(parseHHMM('00:00'), 0);
  assert.equal(parseHHMM('23:59'), 1439);
  assert.equal(parseHHMM('24:00'), -1);
  assert.equal(parseHHMM('7시'), -1);
});

test('localParts 는 기기 타임존으로 현지 시각을 뽑는다', () => {
  const at = kst(2026, 5, 10, 7, 30);
  const seoul = localParts(at, 'Asia/Seoul');
  assert.equal(seoul.hhmm, '07:30');
  assert.equal(seoul.date, '2026-05-10');
  assert.equal(seoul.minutes, 450);

  // 같은 순간이라도 타임존이 다르면 현지 시각이 다르다
  const utc = localParts(at, 'UTC');
  assert.equal(utc.hhmm, '22:30');
  assert.equal(utc.date, '2026-05-09');
});

test('localParts 는 이상한 타임존이면 한국 시간으로 떨어진다', () => {
  const at = kst(2026, 5, 10, 7, 30);
  assert.equal(localParts(at, '아무거나').hhmm, '07:30');
});

test('localParts 는 자정을 00:00 으로 준다', () => {
  assert.equal(localParts(kst(2026, 5, 10, 0, 0), 'Asia/Seoul').hhmm, '00:00');
});

test('예정 시각 정각에 고른다', () => {
  const jobs = dueJobs([device()], kst(2026, 5, 10, 7, 30), new Set());
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].slot.id, 's-morning');
  assert.equal(jobs[0].key, 'sent:dev-1:2026-05-10:s-morning');
});

test('cron 이 몇 분 늦어도 놓치지 않는다', () => {
  for (const late of [1, 2, 3, 4]) {
    const jobs = dueJobs([device()], kst(2026, 5, 10, 7, 30 + late), new Set());
    assert.equal(jobs.length, 1, `${late}분 늦음`);
  }
});

test('너무 늦으면 안 보낸다 — 8시에 오는 "일어났어?"는 소용없다', () => {
  assert.equal(dueJobs([device()], kst(2026, 5, 10, 7, 35), new Set()).length, 0);
  assert.equal(dueJobs([device()], kst(2026, 5, 10, 9, 0), new Set()).length, 0);
});

test('시간 전에는 안 보낸다', () => {
  assert.equal(dueJobs([device()], kst(2026, 5, 10, 7, 29), new Set()).length, 0);
});

test('이미 보낸 건 건너뛴다', () => {
  const skip = new Set(['sent:dev-1:2026-05-10:s-morning']);
  assert.equal(dueJobs([device()], kst(2026, 5, 10, 7, 31), skip).length, 0);
});

test('날짜가 바뀌면 다시 보낸다', () => {
  const skip = new Set(['sent:dev-1:2026-05-10:s-morning']);
  const jobs = dueJobs([device()], kst(2026, 5, 11, 7, 30), skip);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].date, '2026-05-11');
});

test('시각이 깨진 슬롯은 조용히 건너뛴다', () => {
  const d = device({ slots: [{ id: 'bad', time: '아침', title: 'x', bodies: ['a'] }] });
  assert.equal(dueJobs([d], kst(2026, 5, 10, 7, 30), new Set()).length, 0);
});

test('기기가 여러 대면 각각 자기 타임존으로 계산한다', () => {
  const seoul = device();
  const london = { ...device(), deviceId: 'dev-2' };
  london.config = { ...london.config, deviceId: 'dev-2', timezone: 'Europe/London' };

  // 한국 07:30 = 런던 23:30(전날) → 서울 기기만 걸린다
  const jobs = dueJobs([seoul, london], kst(2026, 5, 10, 7, 30), new Set());
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].device.deviceId, 'dev-1');
});
