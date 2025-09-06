import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export const useTranslation = () => {
  const router = useRouter();
  const { locale } = router;
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const response = await fetch(`/locales/${locale}/common.json`);
        const data = await response.json();
        setTranslations(data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading translations:", error);
        // Fallback to English
        const fallbackResponse = await fetch("/locales/en/common.json");
        const fallbackData = await fallbackResponse.json();
        setTranslations(fallbackData);
        setLoading(false);
      }
    };

    loadTranslations();
  }, [locale]);

  const t = (key, options = {}) => {
    const keys = key.split(".");
    let value = translations;

    for (const k of keys) {
      value = value?.[k];
    }

    if (value === undefined) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }

    // Handle interpolation
    if (typeof value === "string" && options) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return options[key] || match;
      });
    }

    return value;
  };

  const changeLanguage = (newLocale) => {
    router.push(router.asPath, router.asPath, { locale: newLocale });
  };

  return {
    t,
    locale,
    changeLanguage,
    loading,
    availableLocales: ["en", "pt", "es", "fr"],
  };
};
