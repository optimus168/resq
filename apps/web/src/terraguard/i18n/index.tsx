import React, { createContext, useContext, useEffect, useState } from 'react';
import enTranslations from './en/common.json';

export type AppLanguage = 'en';
export type ChatbotLanguage = 'en';

export const APP_LANGUAGE_STORAGE_KEY = 'terraguard_language';
export const CHATBOT_LANGUAGE_STORAGE_KEY = 'terraguard_chatbot_language';
export const CHATBOT_LANGUAGE_EXPLICIT_STORAGE_KEY = 'terraguard_chatbot_language_explicit';

export const appLanguageOptions: Array<{ id: AppLanguage; label: string }> = [
  { id: 'en', label: 'English' },
];

export const chatbotLanguageOptions: Array<{ id: ChatbotLanguage; label: string }> = [
  { id: 'en', label: 'English' },
];

const translations = {
  en: enTranslations,
} as const;

const safeRead = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWrite = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
};

const safeRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
};

export const resolveAppLanguage = (): AppLanguage => 'en';

export const resolveChatbotLanguage = (_appLanguage: AppLanguage = 'en'): ChatbotLanguage => 'en';

export const getTranslationValue = (_language: AppLanguage, key: string, fallback?: string): string => {
  const segments = key.split('.');
  let value: unknown = translations.en;

  for (const segment of segments) {
    if (value && typeof value === 'object' && segment in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[segment];
    } else {
      value = undefined;
      break;
    }
  }

  if (typeof value === 'string') {
    return value;
  }

  return fallback ?? key;
};

interface I18nContextValue {
  language: AppLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<AppLanguage>>;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<AppLanguage>(resolveAppLanguage);

  useEffect(() => {
    safeWrite(APP_LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = {
    language,
    setLanguage,
    t: (key: string, fallback?: string) => getTranslationValue(language, key, fallback),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    const fallbackLanguage = resolveAppLanguage();
    return {
      language: fallbackLanguage,
      setLanguage: () => undefined,
      t: (key: string, fallback?: string) => getTranslationValue(fallbackLanguage, key, fallback),
    };
  }
  return context;
};

export const useChatbotLanguage = (_appLanguage: AppLanguage = 'en') => {
  const language: ChatbotLanguage = 'en';
  const isExplicit = false;
  const setLanguage: React.Dispatch<React.SetStateAction<ChatbotLanguage>> = () => undefined;
  return { language, isExplicit, setLanguage };
};

export type TranslationKey = keyof typeof enTranslations;
