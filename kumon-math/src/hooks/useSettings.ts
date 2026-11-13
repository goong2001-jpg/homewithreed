import { useCallback, useState } from 'react';
import { Settings, loadSettings, saveSettings } from '../words/settings';

/** 엄마·아빠 설정 — localStorage 에 두어 어느 화면에서나 같은 값을 본다 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const change = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, change };
}
