import { useState, useCallback, useEffect } from 'react';
import { translations } from './translations';

const DEFAULT_LANG = 'zh';

// 全局语言状态
let currentLang = localStorage.getItem('pulse_lang') || DEFAULT_LANG;
const listeners = new Set();

export function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('pulse_lang', lang);
  listeners.forEach(fn => fn(lang));
}

export function getLanguage() {
  return currentLang;
}

export function useI18n() {
  const [lang, setLang] = useState(currentLang);

  useEffect(() => {
    const handler = (newLang) => setLang(newLang);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const dict = translations[lang] || translations[DEFAULT_LANG];

  const t = useCallback((key, params) => {
    let text = dict[key] || translations[DEFAULT_LANG][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }, [lang, dict]);

  return { t, lang, setLanguage };
}
