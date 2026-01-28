import { useState, useEffect } from 'react';
import type { UserSettings } from '@/types';

const SETTINGS_KEY = 'tool-pick-list-settings';

const defaultSettings: UserSettings = {
  user_name: '',
  theme: 'system',
};

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      } catch {
        setSettings(defaultSettings);
      }
    }
    setLoaded(true);
  }, []);

  const updateSettings = (updates: Partial<UserSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  const getUserName = (): string => {
    return settings.user_name || 'Anonymous';
  };

  return {
    settings,
    loaded,
    updateSettings,
    getUserName,
  };
}
