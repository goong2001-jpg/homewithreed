import { useState, useCallback } from 'react';
import { AppSettings } from '../types';

const STORAGE_KEY = 'receipt_tracker_settings';

function load(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { geminiApiKey: '' };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  const setApiKey = useCallback((key: string) => {
    setSettings(prev => {
      const next = { ...prev, geminiApiKey: key };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, setApiKey };
}
