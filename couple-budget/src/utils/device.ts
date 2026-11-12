/**
 * 이 폰에만 두는 설정 (v17).
 *
 * ⚠️ 절대 동기화하지 않는다. '이 폰은 누구 폰인가'는 기기의 성질이라,
 *    같이 넘기면 두 폰이 서로의 값을 덮어쓴다. 백업 파일에도 넣지 않는다.
 * 키 `couple_budget_device` 는 새로 더한 것이다 — 기존 키는 건드리지 않는다.
 */
import { load, save } from './storage';

export const DEVICE_KEY = 'couple_budget_device';

export interface DevicePrefs {
  /** 이 폰 주인 — 입력 화면에서 '누가' 의 기본값 */
  ownerId?: string;
  /** '고정지출로 옮길까요?' 에 '아니에요'라고 답한 후보 (recurringCandidates 의 key) */
  dismissedRecurring?: string[];
}

export function loadDevice(): DevicePrefs {
  const raw = load<DevicePrefs>(DEVICE_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function saveDevice(patch: Partial<DevicePrefs>): DevicePrefs {
  const next = { ...loadDevice(), ...patch };
  save(DEVICE_KEY, next);
  return next;
}

/**
 * 입력 화면의 기본 사람. 주인이 정해져 있고 아직 목록에 있으면 그 사람, 아니면 첫 번째.
 * (주인으로 정한 사람이 지워졌을 수 있다)
 */
export function defaultPersonId(
  persons: { id: string; order: number }[], ownerId: string | undefined,
): string {
  if (ownerId && persons.some(p => p.id === ownerId)) return ownerId;
  const first = [...persons].sort((a, b) => a.order - b.order)[0];
  return first?.id ?? 'p1';
}
