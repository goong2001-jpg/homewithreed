import { useCallback, useState } from 'react';
import { AppSettings, DEFAULT_SETTINGS, Person, SyncSettings } from '../types';
import { KEYS, load, save } from '../utils/storage';

function loadSettings(): AppSettings {
  const raw = load<Partial<AppSettings>>(KEYS.settings, {});
  return {
    persons: raw.persons?.length ? raw.persons : DEFAULT_SETTINGS.persons,
    sync: { ...DEFAULT_SETTINGS.sync, ...(raw.sync ?? {}) },
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      save(KEYS.settings, next);
      return next;
    });
  }, []);

  const setPersons = useCallback((persons: Person[]) => update({ persons }), [update]);

  const setSync = useCallback((patch: Partial<SyncSettings>) => {
    setSettings(prev => {
      const next = { ...prev, sync: { ...prev.sync, ...patch } };
      save(KEYS.settings, next);
      return next;
    });
  }, []);

  return { settings, setPersons, setSync };
}
