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
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTranslations(data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading translations:", error);
        // Fallback to English
        try {
          const fallbackResponse = await fetch("/locales/en/common.json");
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            setTranslations(fallbackData);
          } else {
            // If even English fails, use hardcoded fallback
            setTranslations({
              header: { title: "Gracie Barra", subtitle: "Find a School" },
              search: { placeholder: "Search locations...", button: "Search", locationButton: "Use my location", showAll: "Show all locations" },
              filters: { premium: "Premium only", country: "All countries", region: "All regions", allLocations: "All locations" },
              status: { loading: "Loading...", searching: "Searching...", loadingLocations: "Loading locations...", ready: "Ready to search", error: "Error loading locations", noResults: "No locations found", foundResults: "Found {{count}} locations" },
              results: { title: "Search Results", titleWithCount: "Search Results ({{count}})", noResults: "No search results found. Try adjusting your filters or search terms." },
              actions: { getDirections: "Get Directions" },
              location: { schoolName: "School Name", address: "Address", phone: "Phone", email: "Email", website: "Website", instructor: "Head Instructor", premium: "Premium School", notAvailable: "Not Available", visitWebsite: "Visit Website", emailSchool: "Email School", callNow: "Call Now", premiumDescription: "Gracie Barra Premium Schools are academies that meet a higher standard of excellence within the Gracie Barra network. These schools go beyond the basic operational standards, reflecting the highest level of compliance with Gracie Barra's methodology, facilities, and service quality." },
              map: { loading: "Loading map...", error: "Map loading error" },
              languages: { en: "English", pt: "Português", es: "Español", fr: "Français" }
            });
          }
        } catch (fallbackError) {
          console.error("Error loading fallback translations:", fallbackError);
          // Use minimal fallback
          setTranslations({
            header: { title: "Gracie Barra", subtitle: "Find a School" },
            search: { placeholder: "Search locations...", button: "Search", locationButton: "Use my location", showAll: "Show all locations" },
            filters: { premium: "Premium only", country: "All countries", region: "All regions", allLocations: "All locations" },
            status: { loading: "Loading...", searching: "Searching...", loadingLocations: "Loading locations...", ready: "Ready to search", error: "Error loading locations", noResults: "No locations found", foundResults: "Found {{count}} locations" },
            results: { title: "Search Results", titleWithCount: "Search Results ({{count}})", noResults: "No search results found. Try adjusting your filters or search terms." },
            actions: { getDirections: "Get Directions" },
            location: { schoolName: "School Name", address: "Address", phone: "Phone", email: "Email", website: "Website", instructor: "Head Instructor", premium: "Premium School", notAvailable: "Not Available", visitWebsite: "Visit Website", emailSchool: "Email School", callNow: "Call Now", premiumDescription: "Gracie Barra Premium Schools are academies that meet a higher standard of excellence within the Gracie Barra network. These schools go beyond the basic operational standards, reflecting the highest level of compliance with Gracie Barra's methodology, facilities, and service quality." },
            map: { loading: "Loading map...", error: "Map loading error" },
            languages: { en: "English", pt: "Português", es: "Español", fr: "Français" }
          });
        }
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
