import { useCallback, useState } from 'react';
import { DevicePrefs, loadDevice, saveDevice } from '../utils/device';

/** 이 폰에만 두는 설정 — utils/device.ts 주석 참고 (동기화 금지) */
export function useDevice() {
  const [device, setDevice] = useState<DevicePrefs>(loadDevice);

  const setOwner = useCallback((ownerId: string) => {
    setDevice(saveDevice({ ownerId }));
  }, []);

  const dismissRecurring = useCallback((key: string) => {
    const prev = loadDevice().dismissedRecurring ?? [];
    if (prev.includes(key)) return;
    // 끝없이 쌓이지 않게 최근 50개만 기억한다
    setDevice(saveDevice({ dismissedRecurring: [...prev, key].slice(-50) }));
  }, []);

  return { device, setOwner, dismissRecurring };
}
