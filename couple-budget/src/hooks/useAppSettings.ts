import { useCallback, useState } from 'react';
import { AppSettings, DEFAULT_SETTINGS, SyncSettings } from '../types';
import { KEYS, load, save } from '../utils/storage';

function loadSettings(): AppSettings {
  const raw = load<Partial<AppSettings>>(KEYS.settings, {});
  // 사람 목록은 예전엔 여기 있었지만 동기화가 안 돼서 useLedger 로 옮겼다.
  // 옛 값은 useLedger 의 loadPersons() 가 한 번 읽어 이사시킨다.
  return { sync: { ...DEFAULT_SETTINGS.sync, ...(raw.sync ?? {}) } };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const setSync = useCallback((patch: Partial<SyncSettings>) => {
    setSettings(prev => {
      const next = { ...prev, sync: { ...prev.sync, ...patch } };
      save(KEYS.settings, next);
      return next;
    });
  }, []);

  return { settings, setSync };
}
