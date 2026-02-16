import React, { useEffect, useState, useCallback, useRef } from "react";
import mapboxgl from "mapbox-gl";
import styles from "../styles/style.module.css";
import "mapbox-gl/dist/mapbox-gl.css";

import Image from "next/image";
import { useTranslation } from "../hooks/useTranslation";
import safeStorage from "../utils/safeStorage";
import { debounce } from "../utils/debounce";

// NOTE: Field IDs are only needed for reference in the component
// The actual API calls are now made through server-side routes (/api/locations, /api/geocode)
// These constants are kept for backward compatibility with the component logic
const LATITUDE_FIELD_ID = "fldoASseEokHCg17B";
const LONGITUDE_FIELD_ID = "fldQuP8QlHcGLuA1N";
const ADDRESS_FIELD_ID = "fldViafjwGIa9SV5A";
const SCHOOL_FIELD_ID = "fldasDCUgASfUdKzS";
const HEAD_INSTRUCTOR_FIELD_ID = "fldE7yKKPdguZQxf3";
const PHONE_FIELD_ID = "fldEfLIrihVPIs9Ig";
const EMAIL_FIELD_ID = "fldlt9aaBsG1BsGOW";
const WEBSITE_FIELD_ID = "fldNf9Wy31ytQSHih";
const IS_PREMIUM_FIELD_ID = "fldz7T3CgMibrITSF";
const COUNTRY_FIELD_ID = "fldUzCdFx9eaLaK00";
const REGION_FIELD_ID = "fldYWyxokH8Zd9BIU";
const SCHOOL_ADDRESS_FIELD_ID = "fldZ6B3ztVZModUp0";
const GB_NAME_FIELD_ID = "fldlMMu2LaP0fgpnH";

// Airtable configuration (IDs only - not sensitive)
// These are used for cache keys and component logic
// The actual API calls use server-side routes with secure credentials
const AIRTABLE_BASE_ID = "app9BVOQW0SHGvr9S";
const AIRTABLE_TABLE_ID = "tblsIFvz8ddEDQn12";
const AIRTABLE_VIEW_ID = "viwrD30IEqinIIddq";

// Mapbox display token (restricted to display only - no geocoding)
const MAPBOX_DISPLAY_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_DISPLAY_TOKEN;

// Set the access token for mapboxgl (display only)
if (typeof window !== "undefined") {
  if (!MAPBOX_DISPLAY_TOKEN) {
    console.error("Mapbox display token is missing");
  } else {
    mapboxgl.accessToken = MAPBOX_DISPLAY_TOKEN;
    mapboxgl.workerClass = null; // Disable worker to avoid cross-origin issues
  }
}

// Default center coordinates (World view)
const DEFAULT_CENTER = [0, 0];

const getPremiumOptions = (t) => [
  { value: "all", label: t("filters.allLocations") },
  { value: "premium", label: t("filters.premium") },
];

const getCountryOptions = (countries, t) => [
  { value: "all", label: t("filters.country") },
  ...countries.map((country) => ({ value: country, label: country })),
];

const getRegionOptions = (regions, t) => [
  { value: "all", label: t("filters.region") },
  ...regions.map((region) => ({ value: region, label: region })),
];

// Haversine formula to calculate distance between two latitude/longitude points
function haversineDistance(coords1, coords2) {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371e3; // Earth radius in meters
  const ϕ1 = (lat1 * Math.PI) / 180;
  const ϕ2 = (lat2 * Math.PI) / 180;
  const Δϕ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δϕ / 2) * Math.sin(Δϕ / 2) +
    Math.cos(ϕ1) * Math.cos(ϕ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceInMeters = R * c; // in meters
  return distanceInMeters / 1609.34; // Convert meters to miles
}

// Mobile detection utility
function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// HTML escape helper to prevent XSS in popup content
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// URL sanitizer -- only allow http/https protocols
function sanitizeUrl(url) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z0-9]/.test(trimmed)) return "https://" + trimmed;
  return "";
}

// Use default Mapbox popup positioning - no custom offsets
const calculatePopupOffset = () => {
  // Return default offset for perfect pin alignment
  return [0, 0];
};

// Make popup draggable
const makePopupDraggable = (popupContent, popup) => {
  // Disable dragging on mobile for better performance
  if (window.innerWidth <= 768) {
    return;
  }

  let isDragging = false;
  let startX, startY, initialOffsetX, initialOffsetY;
  let animationFrame = null;

  // Add drag handle to the header - look for the draggable header
  const header = popupContent.querySelector("[data-draggable='true']");
  if (!header) {
    return;
  }

  // Add cursor style to indicate draggable
  header.style.cursor = "grab";
  header.style.userSelect = "none";
  header.style.touchAction = "none"; // Prevent scrolling on touch devices

  const startDrag = (e) => {
    isDragging = true;
    startX = e.clientX || e.touches[0].clientX;
    startY = e.clientY || e.touches[0].clientY;

    // Initialize offset tracking - Mapbox doesn't have getOffset method
    initialOffsetX = 0;
    initialOffsetY = 0;

    // Add visual feedback immediately
    header.style.cursor = "grabbing";
    header.style.opacity = "0.9";
    header.style.transform = "scale(1.05)";
    header.style.transition = "none"; // Disable transitions during drag

    // Prevent text selection and scrolling during drag
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    document.body.style.overflow = "hidden";

    e.preventDefault();
    e.stopPropagation();
  };

  const drag = (e) => {
    if (!isDragging) return;

    // Use requestAnimationFrame for smoother dragging
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }

    animationFrame = requestAnimationFrame(() => {
      const currentX = e.clientX || e.touches[0].clientX;
      const currentY = e.clientY || e.touches[0].clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Calculate new offset from initial position
      const newOffsetX = initialOffsetX + deltaX;
      const newOffsetY = initialOffsetY + deltaY;

      // Keep popup within reasonable bounds - increased for better responsiveness
      const maxOffset = 300; // Increased maximum offset
      const constrainedOffsetX = Math.max(
        -maxOffset,
        Math.min(maxOffset, newOffsetX)
      );
      const constrainedOffsetY = Math.max(
        -maxOffset,
        Math.min(maxOffset, newOffsetY)
      );

      // Update popup offset to move it while keeping arrow aligned
      popup.setOffset([constrainedOffsetX, constrainedOffsetY]);
    });

    e.preventDefault();
    e.stopPropagation();
  };

  const stopDrag = (e) => {
    if (!isDragging) return;

    isDragging = false;

    // Cancel any pending animation frame
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    // Reset visual feedback with smooth transition
    header.style.cursor = "grab";
    header.style.opacity = "1";
    header.style.transform = "scale(1)";
    header.style.transition = "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)";

    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    document.body.style.overflow = "";

    e.preventDefault();
    e.stopPropagation();
  };

  // Add event listeners for both mouse and touch
  header.addEventListener("mousedown", startDrag, { passive: false });
  header.addEventListener("touchstart", startDrag, { passive: false });

  document.addEventListener("mousemove", drag, { passive: false });
  document.addEventListener("touchmove", drag, { passive: false });

  document.addEventListener("mouseup", stopDrag, { passive: false });
  document.addEventListener("touchend", stopDrag, { passive: false });

  // Clean up on popup close
  popup.on("close", () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    header.removeEventListener("mousedown", startDrag);
    header.removeEventListener("touchstart", startDrag);
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("touchmove", drag);
    document.removeEventListener("mouseup", stopDrag);
    document.removeEventListener("touchend", stopDrag);
  });
};

const Component = () => {
  const { t, locale, changeLanguage, availableLocales } = useTranslation();
  const mapContainer = React.useRef(null);
  const mapInstance = React.useRef(null);
  const userMarkerRef = React.useRef(null);
  const markersRef = React.useRef([]); // Store all markers for proper cleanup
  const markerEventHandlersRef = React.useRef(new Map()); // Track event handlers
  const [map, setMap] = useState(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  // Modal states removed - using small popup system instead
  const [instructorModalIsOpen, setInstructorModalIsOpen] = useState(false);
  const [instructorData, setInstructorData] = useState(null);
  const [searchAddress, setSearchAddress] = useState("");
  const [premiumFilter, setPremiumFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [allLocations, setAllLocations] = useState([]);
  const [uniqueCountries, setUniqueCountries] = useState([]);
  const [uniqueRegions, setUniqueRegions] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinColor, setPinColor] = useState("red");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [activePopup, setActivePopup] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapLoadingProgress, setMapLoadingProgress] = useState(0);
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
  const [isResultsVisible, setIsResultsVisible] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const locationCacheRef = useRef(new Map());
  const [isSearching, setIsSearching] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [isInIframe, setIsInIframe] = useState(false);
  const [sidebarHeight, setSidebarHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isChromeEmulator, setIsChromeEmulator] = useState(false);
  const searchResultsRef = useRef(null);
  const mapRef = useRef(null);

  // Phone number formatting function
  const formatPhoneNumber = (phone) => {
    if (!phone || typeof phone !== "string") return "";

    // Remove all non-digit characters
    const digits = phone.replace(/[^0-9]/g, "");

    // Brazilian numbers (country code 55)
    if (digits.startsWith("55") && digits.length >= 12) {
      const countryCode = digits.slice(0, 2);
      const areaCode = digits.slice(2, 4);
      const firstPart = digits.slice(4, 9);
      const secondPart = digits.slice(9);
      return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
    }

    // US/Canada numbers (country code 1)
    if (digits.startsWith("1") && digits.length === 11) {
      const areaCode = digits.slice(1, 4);
      const firstPart = digits.slice(4, 7);
      const secondPart = digits.slice(7);
      return `+1 (${areaCode}) ${firstPart}-${secondPart}`;
    }

    // US/Canada numbers without country code
    if (digits.length === 10 && !digits.startsWith("55")) {
      const areaCode = digits.slice(0, 3);
      const firstPart = digits.slice(3, 6);
      const secondPart = digits.slice(6);
      return `(${areaCode}) ${firstPart}-${secondPart}`;
    }

    // Default: return original if no pattern matches
    return phone;
  };

  // First, define createLocationPopupContent with useCallback
  const createLocationPopupContent = useCallback(
    (location) => {
      if (!location || typeof location !== "object") {
        return "";
      }

      // Handle both cases: fields at top level or nested under .fields
      const fields = location.fields || location;

      const isPremium = fields[IS_PREMIUM_FIELD_ID] || false;
      // Use GB Name field (formula: replaces "Gracie Barra" with "GB") as primary display name
      const schoolName =
        fields[GB_NAME_FIELD_ID] ||
        fields[SCHOOL_FIELD_ID] ||
        null;

      const locationName =
        schoolName || fields[ADDRESS_FIELD_ID] || t("location.notAvailable");
      const fullAddress =
        fields[ADDRESS_FIELD_ID] || t("location.notAvailable");
      const instructor =
        fields[HEAD_INSTRUCTOR_FIELD_ID] || t("location.notAvailable");
      const phone = fields[PHONE_FIELD_ID];
      const formattedPhone =
        typeof phone === "string" ? formatPhoneNumber(phone) : t("location.notAvailable");
      const phoneDigits =
        typeof phone === "string" ? phone.replace(/[^0-9]/g, "") : "";
      const email = fields[EMAIL_FIELD_ID];
      const website = fields[WEBSITE_FIELD_ID];
      const locationId = location.id || `${locationName}-${fullAddress}`;

      const premiumDescription = t("location.premiumDescription");

      const safeWebsite = sanitizeUrl(website);

      return `
      <div class="${styles.locationCard}" data-location-id="${escapeHtml(locationId)}">
        <div class="${styles.locationHeader}" data-draggable="true">
          <div class="${styles.dragHandle}">⋮⋮</div>
          <h3>${escapeHtml(locationName)}</h3>
          <button class="${
            styles.popupCloseButton
          }" onclick="this.closest('.mapboxgl-popup').remove()" aria-label="Close popup">×</button>
          <div class="${styles.locationBadge} ${
        isPremium ? styles.premiumBadge : styles.regularBadge
      }">
            ${isPremium ? escapeHtml(t("location.premium")) : escapeHtml(t("location.schoolName"))}
          </div>
          ${
            isPremium
              ? `
            <div class="${styles.premiumDescription}">
              ${escapeHtml(premiumDescription)}
            </div>
          `
              : ""
          }
        </div>

        <div class="${styles.locationContent}">
          <div class="${styles.locationInfo}">
            <h4>${escapeHtml(t("location.address"))}</h4>
            <p><a href="https://maps.google.com/?q=${encodeURIComponent(
              fullAddress
            )}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">${escapeHtml(fullAddress)}</a></p>
          </div>

          <div class="${styles.locationInfo}">
            <h4>${escapeHtml(t("location.instructor"))}</h4>
            <p>${escapeHtml(instructor)}</p>
          </div>

          <div class="${styles.locationInfo}">
            <h4>${escapeHtml(t("location.phone"))}</h4>
            <p>${
              phoneDigits
                ? `<a href="tel:${escapeHtml(phoneDigits)}" style="color: #007bff; text-decoration: none;">${escapeHtml(formattedPhone)}</a>`
                : escapeHtml(formattedPhone)
            }</p>
          </div>

          ${
            email
              ? `
          <div class="${styles.locationInfo}">
            <h4>${escapeHtml(t("location.email"))}</h4>
            <p><a href="mailto:${escapeHtml(email)}" style="color: #007bff; text-decoration: none;">${escapeHtml(email)}</a></p>
          </div>
          `
              : ""
          }

          ${
            safeWebsite
              ? `
          <div class="${styles.locationLinks}">
            <a href="${escapeHtml(safeWebsite)}" target="_blank" rel="noopener noreferrer" class="${
                  styles.actionButton
                }">
              ${escapeHtml(t("location.visitWebsite"))}
            </a>
          </div>
          `
              : ""
          }
        </div>
      </div>
    `;
    },
    [t]
  );

  // Clean up all markers properly
  const clearAllMarkers = useCallback(() => {
    // Remove all marker event listeners first
    markersRef.current.forEach((marker) => {
      const handlers = markerEventHandlersRef.current.get(marker);
      if (handlers) {
        handlers.element.removeEventListener("click", handlers.handler);
        markerEventHandlersRef.current.delete(marker);
      }
      marker.remove(); // Proper Mapbox cleanup
    });
    markersRef.current = [];
  }, []);

  const closeAllPopups = useCallback(() => {
    if (activePopup) {
      activePopup.remove();
      setActivePopup(null);
    }
    if (searchResults) {
      searchResults.forEach((result) => {
        if (result.popup) {
          result.popup.remove();
        }
      });
    }
    setActiveCard(null);
    setShowLocationDetails(false);
  }, [searchResults, activePopup]);

  const openPopup = useCallback(
    (popup, coordinates, locationId, locationData) => {
      // Enhanced validation and error handling for mobile stability
      if (!locationData || !coordinates || !mapInstance.current) {
        console.warn('Missing required data for popup:', { locationData: !!locationData, coordinates: !!coordinates, mapInstance: !!mapInstance.current });
        return;
      }

      try {
        // Close existing popups safely
        closeAllPopups();

        // Validate coordinates format
        if (!Array.isArray(coordinates) || coordinates.length !== 2 ||
            typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
          console.error('Invalid coordinates format:', coordinates);
          return;
        }

        // Create popup with mobile-friendly settings
        const newPopup = new mapboxgl.Popup({
          closeButton: false,
          maxWidth: isMobile ? "95vw" : "600px",
          closeOnClick: false,
          className: isMobile ? 'mobile-popup' : '',
          anchor: 'bottom'
        });

        // Generate content safely
        const content = createLocationPopupContent(locationData);
        if (!content || typeof content !== 'string') {
          console.error('Failed to generate popup content');
          return;
        }

        // Add popup to map
        newPopup
          .setLngLat(coordinates)
          .setHTML(content)
          .addTo(mapInstance.current);

        // Add drag functionality only on desktop (causes issues on mobile)
        if (!isMobile) {
          setTimeout(() => {
            try {
              const popupElement = newPopup.getElement();
              if (popupElement) {
                const popupContent = popupElement.querySelector(".mapboxgl-popup-content");
                if (popupContent) {
                  makePopupDraggable(popupContent, newPopup);
                }
              }
            } catch (error) {
              console.warn('Failed to add popup drag functionality:', error);
            }
          }, 100);
        }

        // Set up close handler with error handling
        newPopup.on("close", () => {
          try {
            setActivePopup(null);
            setActiveCard(null);
            setShowLocationDetails(false);
          } catch (error) {
            console.warn('Error in popup close handler:', error);
          }
        });

        // Update states safely
        setActivePopup(newPopup);
        setActiveCard(locationId);
        setShowLocationDetails(true);

      } catch (error) {
        console.error("Error opening popup:", error);
        // Clean up any partial state on error
        try {
          setActivePopup(null);
          setActiveCard(null);
          setShowLocationDetails(false);
        } catch (cleanupError) {
          console.error('Error during popup cleanup:', cleanupError);
        }
      }
    },
    [mapInstance, createLocationPopupContent, closeAllPopups, isMobile]
  );

  // Update batchGeocodeLocations to use the correct field IDs
  const batchGeocodeLocations = async (locations) => {
    const validLocations = locations.filter((loc) => {
      // Check if we have direct coordinates
      if (loc.fields[LATITUDE_FIELD_ID] && loc.fields[LONGITUDE_FIELD_ID]) {
        const lat = parseFloat(loc.fields[LATITUDE_FIELD_ID]);
        const lng = parseFloat(loc.fields[LONGITUDE_FIELD_ID]);
        return (
          !isNaN(lat) &&
          !isNaN(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        );
      }

      // Fallback to address check for geocoding
      const address = loc.fields[SCHOOL_ADDRESS_FIELD_ID];
      return (
        address &&
        typeof address === "string" &&
        address.trim() !== "" &&
        !address.includes("google.com/maps")
      );
    });

    // Process locations with direct coordinates first
    const directLocations = validLocations
      .filter(
        (loc) => loc.fields[LONGITUDE_FIELD_ID] && loc.fields[LATITUDE_FIELD_ID]
      )
      .map((loc) => {
        const coords = [
          parseFloat(loc.fields[LONGITUDE_FIELD_ID]), // Longitude
          parseFloat(loc.fields[LATITUDE_FIELD_ID]), // Latitude
        ];

        return {
          ...loc,
          coordinates: coords,
        };
      });

    // Only geocode locations without coordinates
    const locationsToGeocode = validLocations.filter(
      (loc) => !loc.fields[LONGITUDE_FIELD_ID] || !loc.fields[LATITUDE_FIELD_ID]
    );

    // First check cache for locations that need geocoding
    const uncachedLocations = locationsToGeocode.filter(
      (loc) => !locationCacheRef.current.has(loc.fields[SCHOOL_ADDRESS_FIELD_ID])
    );

    if (uncachedLocations.length === 0) {
      const geocodedLocations = locationsToGeocode.map((loc) => ({
        ...loc,
        coordinates: locationCacheRef.current.get(loc.fields[SCHOOL_ADDRESS_FIELD_ID]),
      }));
      return [...directLocations, ...geocodedLocations];
    }

    // Process remaining locations that need geocoding using server-side API
    try {
      // Prepare addresses for batch geocoding
      const addresses = uncachedLocations.map((loc) => loc.fields["School Address"].trim());

      // Call server-side geocoding API (secure - no exposed keys!)
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses,
          type: 'forward'
        }),
      });

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];

      // Process successful geocoding results
      const geocodedLocations = uncachedLocations
        .map((location, index) => {
          const result = results[index];
          if (result && result.success && result.coordinates) {
            const address = location.fields[SCHOOL_ADDRESS_FIELD_ID].trim();
            // Update cache
            locationCacheRef.current.set(address, result.coordinates);
            return { ...location, coordinates: result.coordinates };
          }
          return null;
        })
        .filter(Boolean);

      // Add cached locations
      const cachedResults = locationsToGeocode
        .filter((loc) =>
          locationCacheRef.current.has(loc.fields[SCHOOL_ADDRESS_FIELD_ID])
        )
        .map((loc) => ({
          ...loc,
          coordinates: locationCacheRef.current.get(loc.fields[SCHOOL_ADDRESS_FIELD_ID]),
        }));

      // Combine direct coordinates with geocoded results
      return [...directLocations, ...geocodedLocations, ...cachedResults];
    } catch (error) {
      console.error("Geocoding error:", error);
      return directLocations; // Return at least the direct coordinate locations
    }
  };

  // Toggle the collapsed state of the search section
  const toggleCollapse = () => {
    setIsCollapsed((prevState) => !prevState);
  };

  // Toggle search panel
  const toggleSearch = () => {
    setIsSearchCollapsed((prev) => !prev);
  };

  // Toggle results panel
  const toggleResults = () => {
    setIsResultsVisible((prev) => !prev);
  };

  // Fetch locations from server-side API (secure - no exposed keys)
  const fetchLocations = async (forceRefresh = false) => {
    try {
      // First try to get from cache using safe storage
      const cacheKey = "locations-cache";
      const cachedData = safeStorage.getItem(cacheKey);
      const cacheTimestamp = safeStorage.getItem(`${cacheKey}-timestamp`);

      // Check if cache is valid (less than 5 minutes old) and not forcing refresh
      if (
        !forceRefresh &&
        cachedData &&
        cacheTimestamp &&
        Date.now() - parseInt(cacheTimestamp) < 300000
      ) {
        try {
          return JSON.parse(cachedData);
        } catch (parseError) {
          console.warn('Failed to parse cached data, fetching fresh data');
          // Continue to fetch fresh data if parse fails
        }
      }

      // Clear old cache if forcing refresh
      if (forceRefresh) {
        safeStorage.removeItem(cacheKey);
        safeStorage.removeItem(`${cacheKey}-timestamp`);
      }

      // Fetch from server-side API route (no exposed keys!)
      const response = await fetch(`/api/locations?forceRefresh=${forceRefresh}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const allRecords = data.records || [];

      // Cache the results using safe storage
      safeStorage.setItem(cacheKey, JSON.stringify(allRecords));
      safeStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());

      // Store all locations in state for filtering
      setAllLocations(allRecords);

      // Extract unique countries and regions
      const countries = [
        ...new Set(
          allRecords
            .map((record) => record.fields[COUNTRY_FIELD_ID])
            .filter(
              (country) =>
                country && (typeof country === "string" ? country.trim() : true)
            )
        ),
      ].sort();

      const regions = [
        ...new Set(
          allRecords
            .map((record) => {
              const region = record.fields[REGION_FIELD_ID];
              // Handle both string and array cases
              if (Array.isArray(region)) {
                return region.filter((r) => r && r.trim());
              }
              return region && region.trim() ? [region] : [];
            })
            .flat()
            .filter((region) => region && region.trim())
        ),
      ].sort();

      setUniqueCountries(countries);
      setUniqueRegions(regions);

      return allRecords;
    } catch (error) {
      console.error("Error fetching locations:", error);
      setLocationError("Unable to fetch locations. Please try again later.");
      return [];
    }
  };

  const showLocationPanel = (location, color) => {
    setPinColor(color);
    setShowLocationDetails(true);
  };

  const hideLocationPanel = () => {
    setShowLocationDetails(false);
  };

  const openInstructorModal = (instructor) => {
    setInstructorData(instructor);
    setInstructorModalIsOpen(true);
  };

  const closeInstructorModal = () => {
    setInstructorModalIsOpen(false);
    setInstructorData(null);
  };

  // Convert coordinates to an address using server-side geocoding API
  const reverseGeocode = async (coords) => {
    try {
      if (!coords || !Array.isArray(coords) || coords.length !== 2) {
        throw new Error("Invalid coordinates provided");
      }

      // Call server-side geocoding API (secure - no exposed keys!)
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses: [coords],
          type: 'reverse'
        }),
      });

      if (!response.ok) {
        throw new Error(`Reverse geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.results && data.results[0] && data.results[0].success) {
        return data.results[0].address;
      }
      return `${coords[1]}, ${coords[0]}`; // Fallback to coords if no address is found
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return `${coords[1]}, ${coords[0]}`; // Fallback in case of error
    }
  };

  // Cleanup function to remove user marker
  const removeUserMarker = useCallback(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, []);

  // Cleanup function for component unmount
  useEffect(() => {
    return () => {
      removeUserMarker();
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [removeUserMarker]);

  const addUserMarker = useCallback(
    (coordinates) => {
      if (!mapInstance.current) {
        return;
      }

      try {
        // Validate coordinates
        if (
          !coordinates ||
          !Array.isArray(coordinates) ||
          coordinates.length !== 2 ||
          !isFinite(coordinates[0]) ||
          !isFinite(coordinates[1])
        ) {
          return;
        }

        // Ensure coordinates are within valid range
        const lng = ((coordinates[0] + 180) % 360) - 180;
        const lat = Math.max(-90, Math.min(90, coordinates[1]));

        // Remove existing user marker
        removeUserMarker();

        // Create marker element with inner dot for pulsing effect
        const el = document.createElement("div");
        el.className = styles.userMarker;

        // Create inner dot
        const innerDot = document.createElement("div");
        innerDot.className = styles.userMarkerInner;
        el.appendChild(innerDot);

        // Create pulse effect
        const pulse = document.createElement("div");
        pulse.className = styles.userMarkerPulse;
        el.appendChild(pulse);

        const newUserMarker = new mapboxgl.Marker({
          element: el,
          anchor: "center",
          offset: [0, 0],
        })
          .setLngLat([lng, lat])
          .addTo(mapInstance.current);

        // Store the marker reference
        userMarkerRef.current = newUserMarker;
        setUserLocation([lng, lat]);
      } catch (error) {
        console.error("Error adding user marker:", error);
      }
    },
    [removeUserMarker]
  );

  // Memoize the getCurrentPosition function
  const getCurrentPosition = useCallback((options = {}) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setLocationError("Please enter your address to find nearby schools.");
        reject({ handled: true });
        return;
      }

      const maxAttempts = 3;
      let attempts = 0;
      let timeoutId;

      const tryGetLocation = () => {
        attempts++;
        setLocationError("Finding your location...");

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const timeout = Math.min(5000 * attempts, 15000);

        timeoutId = setTimeout(() => {
          if (attempts < maxAttempts) {
            tryGetLocation();
          } else {
            setLocationError(
              "Please enter your address to find nearby schools."
            );
            reject({ handled: true });
          }
        }, timeout);

        const geolocationOptions = {
          enableHighAccuracy: attempts === 1,
          timeout: timeout,
          maximumAge: attempts === maxAttempts ? 30000 : 0,
          ...options,
        };

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve(position);
          },
          (error) => {
            clearTimeout(timeoutId);

            switch (error.code) {
              case error.PERMISSION_DENIED:
                setLocationError(
                  "Please enable location access to find nearby schools."
                );
                reject({ handled: true });
                break;
              case error.POSITION_UNAVAILABLE:
              case error.TIMEOUT:
              default:
                if (attempts < maxAttempts) {
                  setTimeout(tryGetLocation, 1000);
                } else {
                  setLocationError(
                    "Please enter your address to find nearby schools."
                  );
                  reject({ handled: true });
                }
            }
          },
          geolocationOptions
        );
      };

      tryGetLocation();
    });
  }, []);

  const animateMapMove = (mapInstance, { center, zoom, duration, pitch }) => {
    return new Promise((resolve) => {
      mapInstance.flyTo({
        center,
        zoom,
        duration,
        pitch,
        essential: true,
        curve: 1.42,
        speed: 1.2,
        easing: (t) => t * (2 - t), // Ease out quadratic
      });

      mapInstance.once("moveend", resolve);
    });
  };

  const getUserLocation = async () => {
    if (!mapInstance.current) {
      setLocationError("Please try again in a moment.");
      return;
    }

    try {
      setLocationError(null);
      setLoading(true);

      await animateMapMove(mapInstance.current, {
        zoom: mapInstance.current.getZoom() - 1,
        center: mapInstance.current.getCenter(),
        duration: 500,
        pitch: 0,
      });

      if (navigator.geolocation) {
        try {
          const position = await getCurrentPosition();

          // Only proceed if we got a valid position
          if (!position || position.handled) {
            return;
          }

          const { latitude, longitude } = position.coords;

          if (
            !isFinite(latitude) ||
            !isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            setLocationError(
              "Unable to determine your location. Please enter your address."
            );
            return;
          }

          await animateMapMove(mapInstance.current, {
            center: [longitude, latitude],
            zoom: 12,
            duration: 2000,
            pitch: 45,
          });

          addUserMarker([longitude, latitude]);
          setLocationError(null);
          await runSearch([longitude, latitude], 50, premiumFilter);
        } catch (error) {
          // Only handle unhandled errors
          if (!error.handled) {
            setLocationError(
              "Please enter your address to find nearby schools."
            );
          }
        }
      } else {
        setLocationError("Please enter your address to find nearby schools.");
      }
    } catch (error) {
      // Only handle unhandled errors
      if (!error.handled) {
        setLocationError("Please enter your address to find nearby schools.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to filter locations based on current filters
  const filterAndDisplayLocations = useCallback(
    async (locations = allLocations) => {
      if (!mapInstance.current || !locations.length) return;

      // Set loading state to prevent premature clicks
      setLoading(true);
      setIsInitialLoading(true);

      // Clear existing markers properly
      clearAllMarkers();

      // Filter locations based on current filters
      let filteredLocations = locations;

      // Apply premium filter
      if (premiumFilter === "premium") {
        filteredLocations = filteredLocations.filter(
          (loc) => loc.fields[IS_PREMIUM_FIELD_ID]
        );
      }

      // Apply country filter
      if (countryFilter !== "all") {
        filteredLocations = filteredLocations.filter(
          (loc) => loc.fields[COUNTRY_FIELD_ID] === countryFilter
        );
      }

      // Apply region filter
      if (regionFilter !== "all") {
        filteredLocations = filteredLocations.filter((loc) => {
          const region = loc.fields[REGION_FIELD_ID];
          if (Array.isArray(region)) {
            return region.includes(regionFilter);
          }
          return region === regionFilter;
        });
      }

      // Geocode filtered locations
      const geocodedLocations = await batchGeocodeLocations(filteredLocations);

      if (geocodedLocations.length === 0) {
        setSearchResults([]);
        setSearchStatus(t("status.noResults"));
        return;
      }

      // Add uniqueId to each location for React list keys
      const locationsWithIds = geocodedLocations.map((location, index) => ({
        ...location,
        uniqueId: `${location.id || ""}-${index}-${
          location.fields[ADDRESS_FIELD_ID] || ""
        }`.replace(/[^a-zA-Z0-9]/g, "-")
      }));

      // Add markers to map in batches to prevent mobile crashes
      const bounds = new mapboxgl.LngLatBounds();

      // Calculate bounds first (synchronous and fast)
      locationsWithIds.forEach((location) => {
        if (location.coordinates && location.coordinates.length === 2) {
          bounds.extend(location.coordinates);
        }
      });

      // Fit map to show all markers immediately
      if (locationsWithIds.length > 0) {
        mapInstance.current.fitBounds(bounds, { padding: 50 });
      }

      // Create markers in batches to prevent overwhelming the browser
      // Use smaller batches on mobile to prevent crashes
      const BATCH_SIZE = isMobile ? 25 : 100; // Create fewer markers at a time on mobile
      let currentBatch = 0;

      const createMarkerBatch = () => {
        const start = currentBatch * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, locationsWithIds.length);

        for (let i = start; i < end; i++) {
          const location = locationsWithIds[i];

          if (location.coordinates && location.coordinates.length === 2) {
            const isPremium = location.fields[IS_PREMIUM_FIELD_ID];
            const marker = new mapboxgl.Marker({
              color: isPremium ? "#FFD700" : "#FF0000",
              scale: isPremium ? 1.2 : 1,
            })
              .setLngLat(location.coordinates)
              .addTo(mapInstance.current);

            const uniqueId = location.uniqueId;

            // Store marker for proper cleanup
            markersRef.current.push(marker);

            // Create click handler with enhanced error handling for mobile stability
            const handleMarkerClick = (e) => {
              // Prevent event propagation and default behavior
              if (e) {
                e.stopPropagation();
                e.preventDefault();
              }

              try {
                // Prevent clicks while locations are still being processed
                if (loading || isInitialLoading) {
                  return;
                }

                // Close any existing popups first
                closeAllPopups();

                // Validate location data
                if (!location || !location.coordinates || !Array.isArray(location.coordinates)) {
                  console.error('[Marker Click] Invalid location data:', location);
                  return;
                }

                // Create and open popup with mobile-friendly settings
                const popup = new mapboxgl.Popup({
                  closeButton: false,
                  maxWidth: isMobile ? "95vw" : "600px",
                  closeOnClick: false,
                  className: isMobile ? 'mobile-popup' : '',
                  anchor: 'bottom'
                });

                const content = createLocationPopupContent(location);
                if (!content) {
                  console.error('[Marker Click] Failed to generate popup content');
                  return;
                }

                popup
                  .setLngLat(location.coordinates)
                  .setHTML(content)
                  .addTo(mapInstance.current);

                // Add drag functionality only on desktop
                if (!isMobile) {
                  setTimeout(() => {
                    try {
                      const popupElement = popup.getElement();
                      if (popupElement) {
                        const popupContent = popupElement.querySelector(".mapboxgl-popup-content");
                        if (popupContent) {
                          makePopupDraggable(popupContent, popup);
                        }
                      }
                    } catch (error) {
                      console.warn('[Marker Click] Failed to add drag functionality:', error);
                    }
                  }, 100);
                }

                // Set up close handler with error handling
                popup.on("close", () => {
                  try {
                    setActivePopup(null);
                    setActiveCard(null);
                    setShowLocationDetails(false);
                  } catch (error) {
                    console.warn('[Marker Click] Error in popup close handler:', error);
                  }
                });

                // Update states safely
                setActivePopup(popup);
                setActiveCard(uniqueId);
                setShowLocationDetails(true);

              } catch (error) {
                console.error('[Marker Click] Error handling marker click:', error);
                // Clean up any partial state on error
                try {
                  setActivePopup(null);
                  setActiveCard(null);
                  setShowLocationDetails(false);
                } catch (cleanupError) {
                  console.error('[Marker Click] Error during cleanup:', cleanupError);
                }
              }
            };

            // Add event listener and track for cleanup
            const element = marker.getElement();
            element.addEventListener("click", handleMarkerClick);
            markerEventHandlersRef.current.set(marker, {
              element,
              handler: handleMarkerClick
            });

            element.setAttribute("data-location-id", uniqueId);
          }
        }

        currentBatch++;

        // Continue creating markers in next batch if there are more
        if (currentBatch * BATCH_SIZE < locationsWithIds.length) {
          requestAnimationFrame(createMarkerBatch);
        } else {
          // All markers created
        }
      };

      // Start creating markers in batches
      createMarkerBatch();

      setSearchResults(locationsWithIds);
      setSearchStatus(
        `Found ${locationsWithIds.length} ${
          locationsWithIds.length === 1 ? "location" : "locations"
        }`
      );

      // Clear loading state after a delay to ensure markers are created
      // The markers are created asynchronously via requestAnimationFrame
      setTimeout(() => {
        setLoading(false);
        setIsInitialLoading(false);
      }, 500);
    },
    [allLocations, premiumFilter, countryFilter, regionFilter, mapInstance, clearAllMarkers, closeAllPopups, createLocationPopupContent, t]
  );

  // Effect to filter locations when filters change
  // This handles both initial load and filter changes
  useEffect(() => {
    if (allLocations.length > 0 && mapInitialized) {
      // Use setTimeout to defer marker creation slightly
      const timer = setTimeout(() => {
        filterAndDisplayLocations();
      }, 100);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    premiumFilter,
    countryFilter,
    regionFilter,
    allLocations,
    mapInitialized,
  ]);

  // Update the runSearch function
  const runSearch = async (
    addressOrCoords,
    radius,
    premiumFilter,
    forceRefresh = false
  ) => {
    if (!mapInstance.current) return;

    setIsSearching(true);
    setLoading(true);
    setSearchResults([]);
    setLocationError(null);
    setIsResultsVisible(true);
    closeAllPopups();
    clearAllMarkers();

    try {
      // First get all locations
      const allLocations = await fetchLocations(forceRefresh);

      // Filter premium locations if needed
      const filteredByPremium =
        premiumFilter === "premium"
          ? allLocations.filter((loc) => loc.fields[IS_PREMIUM_FIELD_ID])
          : allLocations;

      // Geocode all locations
      const geocodedLocations = await batchGeocodeLocations(filteredByPremium);

      if (!geocodedLocations.length) {
        setLoading(false);
        setLocationError(t("results.noResults"));
        return;
      }

      let searchCoords;
      let centerLocation;
      let fuzzyTextResults = null;

      if (typeof addressOrCoords === "string") {
        const trimmedAddress = addressOrCoords.trim().toLowerCase();
        if (!trimmedAddress) return;

        try {
          // Normalize text for fuzzy matching: remove accents, replace punctuation with spaces
          const normalizeText = (text) =>
            (text || "")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[-_,./()'"]/g, " ")
              .replace(/\s+/g, " ")
              .trim();

          // Tokenize search query
          const searchTokens = normalizeText(trimmedAddress).split(" ").filter(Boolean);

          if (searchTokens.length > 0) {
            // Yield to browser before CPU-intensive scoring
            await new Promise((resolve) => setTimeout(resolve, 0));
            // Score each location by matching tokens against multiple fields
            const scoredMatches = geocodedLocations
              .map((loc) => {
                const fields = loc.fields || {};
                const searchableText = normalizeText(
                  [
                    fields[SCHOOL_FIELD_ID],
                    fields[ADDRESS_FIELD_ID],
                    fields[SCHOOL_ADDRESS_FIELD_ID],
                    fields[COUNTRY_FIELD_ID],
                  ].filter(Boolean).join(" ")
                );

                const matchedTokens = searchTokens.filter((token) =>
                  searchableText.includes(token)
                );

                return {
                  location: loc,
                  matchCount: matchedTokens.length,
                  matchRatio: matchedTokens.length / searchTokens.length,
                };
              })
              .filter((item) => item.matchRatio >= 0.5)
              .sort((a, b) => b.matchRatio - a.matchRatio || b.matchCount - a.matchCount);

            if (scoredMatches.length > 0) {
              const bestMatch = scoredMatches[0].location;
              if (bestMatch.coordinates) {
                searchCoords = bestMatch.coordinates;
                centerLocation = bestMatch;
                // Cap results to prevent performance issues with broad searches
                fuzzyTextResults = scoredMatches.slice(0, 200).map((m) => m.location);
              }
            }
          }

          // Fall back to geocoding if no text matches found
          if (!searchCoords) {
            const response = await fetch('/api/geocode', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                addresses: [trimmedAddress],
                type: 'forward'
              }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.results && data.results[0] && data.results[0].success) {
                searchCoords = data.results[0].coordinates;

                // Find the closest location to these coordinates
                let closestLocation = null;
                let minDistance = Infinity;

                for (const location of geocodedLocations) {
                  if (location.coordinates) {
                    const distance = haversineDistance(
                      searchCoords,
                      location.coordinates
                    );
                    if (distance < minDistance) {
                      minDistance = distance;
                      closestLocation = location;
                    }
                  }
                }

                if (closestLocation) {
                  searchCoords = closestLocation.coordinates;
                  centerLocation = closestLocation;
                }
              }
            }
          }
        } catch (error) {
          console.error("Search/geocoding error:", error);
        }
      } else if (Array.isArray(addressOrCoords)) {
        searchCoords = addressOrCoords;
      }

      if (!searchCoords) {
        setLoading(false);
        setLocationError(t("results.noResults"));
        return;
      }

      // Process results - show fuzzy text matches or locations within radius
      const locationsToShow = fuzzyTextResults || geocodedLocations;
      const bounds = new mapboxgl.LngLatBounds();
      const results = locationsToShow
        .filter((location) => {
          if (!location?.coordinates) return false;
          // For fuzzy text matches, show all results (no radius limit)
          if (fuzzyTextResults) return true;
          // For geographic search, apply radius filter
          const distance = haversineDistance(
            searchCoords,
            location.coordinates
          );
          return radius === "any" || distance <= parseFloat(radius);
        })
        .map((location, index) => {
          const distance = haversineDistance(
            searchCoords,
            location.coordinates
          );
          bounds.extend(location.coordinates);

          const isPremium = location.fields[IS_PREMIUM_FIELD_ID];
          const marker = new mapboxgl.Marker({
            color: isPremium ? "#FFD700" : "#FF0000",
            scale: isPremium ? 1.2 : 1,
          })
            .setLngLat(location.coordinates)
            .addTo(mapInstance.current);

          const uniqueId = `${location.id || ""}-${index}-${
            location.fields[ADDRESS_FIELD_ID] || ""
          }-${location.fields[ADDRESS_FIELD_ID] || ""}`.replace(
            /[^a-zA-Z0-9]/g,
            "-"
          );

          // Store marker for proper cleanup
          markersRef.current.push(marker);

          // Create handler for proper cleanup tracking
          const handleClick = (e) => {
            e.stopPropagation();
            handleLocationSelect({
              ...location,
              coordinates: location.coordinates,
              id: uniqueId,
              index,
              uniqueId,
            });
          };

          // Add event listener and track for cleanup
          const markerElement = marker.getElement();
          markerElement.addEventListener("click", handleClick);
          markerEventHandlersRef.current.set(marker, {
            element: markerElement,
            handler: handleClick
          });

          return {
            ...location,
            uniqueId,
            originalId: location.id,
            index,
            distance,
            coordinates: location.coordinates,
            marker,
          };
        });

      results.sort((a, b) => a.distance - b.distance);
      setSearchResults(results);

      if (results.length > 0) {
        // Extend bounds to include search center
        bounds.extend(searchCoords);

        mapInstance.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 12,
        });

        // If we have a center location, select it
        if (centerLocation) {
          const centerResult = results.find(
            (r) => r.originalId === centerLocation.id
          );
          if (centerResult) {
            handleLocationSelect({
              ...centerResult,
              coordinates: centerResult.coordinates,
            });
          }
        }
      } else {
        setLocationError(t("results.noResults"));
      }

      if (window.innerWidth <= 768) {
        setIsSearchCollapsed(true);
      }

      return results;
    } catch (error) {
      setLocationError(
        "An error occurred during the search. Please try again."
      );
    } finally {
      setLoading(false);
      setIsSearching(false);
      if (mapInstance.current) {
        mapInstance.current.resize();
      }
    }
  };

  // Update handleLocationSelect to include proper error handling
  const handleLocationSelect = useCallback(
    (location) => {
      try {
        if (!location || !location.coordinates) {
          console.error('[handleLocationSelect] Missing location or coordinates');
          return;
        }

        // Close any existing popups first
        closeAllPopups();

        setSelectedLocation(location);
        setActiveCard(location.uniqueId);

        // Smooth map transition to the exact location
        if (mapInstance.current) {
          mapInstance.current.flyTo({
            center: location.coordinates,
            zoom: 14,
            duration: 1000,
            essential: true,
          });

          // Open popup with the location data after a short delay to ensure smooth animation
          setTimeout(() => {
            try {
              openPopup(null, location.coordinates, location.uniqueId, location);
            } catch (popupError) {
              console.error('[handleLocationSelect] Error opening popup:', popupError);
            }
          }, 300);
        } else {
          console.error('[handleLocationSelect] No mapInstance.current');
        }

        // On mobile/iframe, close the sidebar to show the map
        if ((isMobile || isInIframe) && !isSidebarCollapsed) {
          setIsSidebarCollapsed(true);
          // Mark as user interaction to prevent auto-show
          safeStorage.setItem("gb-map-user-interacted", "true");
        }
      } catch (error) {
        console.error("Error in handleLocationSelect:", error, error.stack);
        // Prevent crash on mobile
      }
    },
    [
      mapInstance,
      openPopup,
      closeAllPopups,
      isMobile,
      isInIframe,
      isSidebarCollapsed,
    ]
  );

  // Update the result item click handler
  const handleResultItemClick = useCallback(
    (location, event) => {
      try {
        // Prevent clicks while locations are still being processed
        if (loading || isInitialLoading) {
          if (event) {
            event.preventDefault();
            event.stopPropagation();
          }
          return;
        }

        // Prevent default behavior and event propagation
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }

        handleLocationSelect(location);

        // On mobile/iframe, close the sidebar to show the map
        if ((isMobile || isInIframe) && !isSidebarCollapsed) {
          setIsSidebarCollapsed(true);
          // Mark as user interaction to prevent auto-show
          safeStorage.setItem("gb-map-user-interacted", "true");
        }
      } catch (error) {
        console.error("Error in handleResultItemClick:", error);
        // Prevent crash on mobile
      }
    },
    [handleLocationSelect, isMobile, isInIframe, isSidebarCollapsed, loading, isInitialLoading]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) {
      return;
    }

    if (mapInstance.current) {
      return;
    }

    if (!MAPBOX_DISPLAY_TOKEN) {
      setMapError("Mapbox token is missing");
      return;
    }

    // Ensure container has dimensions before initializing map
    const containerWidth = mapContainer.current.offsetWidth;
    const containerHeight = mapContainer.current.offsetHeight;

    if (!containerWidth || !containerHeight) {
      console.warn("Map container has no dimensions, delaying initialization");
      // Retry after a short delay
      const retryTimeout = setTimeout(() => {
        if (mapContainer.current && !mapInstance.current) {
          const w = mapContainer.current.offsetWidth;
          const h = mapContainer.current.offsetHeight;
          if (w && h) {
            window.location.reload(); // Force reload to reinitialize
          }
        }
      }, 100);
      return () => clearTimeout(retryTimeout);
    }

    try {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: DEFAULT_CENTER,
        zoom: 2,
        minZoom: 1,
        // Add these options to improve stability
        preserveDrawingBuffer: true,
        trackResize: true,
      });

      map.on("load", async () => {
        setMapInitialized(true);
        setIsMapLoading(false);

        // Automatically fetch all locations on map load
        try {
          setIsInitialLoading(true);
          setSearchStatus(t("status.loadingLocations"));

          // Check cache age - if older than 5 minutes or empty, force refresh
          const cacheKey = "locations-cache";
          const cacheTimestamp = safeStorage.getItem(`${cacheKey}-timestamp`);
          const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;
          const shouldForceRefresh = !cacheTimestamp || cacheAge > 300000; // 5 minutes

          await fetchLocations(shouldForceRefresh);

          // The useEffect will handle calling filterAndDisplayLocations
          // when allLocations and mapInitialized are both ready
          setIsInitialLoading(false);
        } catch (error) {
          console.error('Error loading locations:', error);
          setSearchStatus(t("status.error"));
          setIsInitialLoading(false);
        }
      });

      map.on("error", (e) => {
        console.error("Mapbox GL error:", e);
        // Only show critical errors to user
        if (e.error?.message && !e.error.message.includes("matrix")) {
          setMapError(e.error.message);
        }
      });

      // Add additional error event listener for render errors
      map.on("render", () => {
        // Map rendered successfully, clear any previous errors
        if (mapError && mapError.includes("matrix")) {
          setMapError(null);
        }
      });

      mapInstance.current = map;
      setMap(map);
    } catch (error) {
      console.error("Map initialization error:", error);
      setMapError(error.message);
      setIsMapLoading(false);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Add this right after the map initialization useEffect
  useEffect(() => {
    const resizeMap = () => {
      if (mapInstance.current) {
        mapInstance.current.resize();
      }
    };

    // Resize on mount
    resizeMap();

    // Resize on window resize
    window.addEventListener("resize", resizeMap);

    // Resize when search container collapses/expands
    const observer = new ResizeObserver(resizeMap);
    if (mapContainer.current) {
      observer.observe(mapContainer.current);
    }

    return () => {
      window.removeEventListener("resize", resizeMap);
      observer.disconnect();
    };
  }, []);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      closeAllPopups();
    };
  }, [closeAllPopups]);

  // Update map click handler to close popups when clicking elsewhere on the map
  useEffect(() => {
    if (map) {
      map.on("click", closeAllPopups);
      return () => {
        map.off("click", closeAllPopups);
      };
    }
  }, [map, closeAllPopups]);

  const handleCloseResults = () => {
    setIsResultsVisible(false);
  };

  const handleKeyDown = (e, location) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleLocationSelect(location);

      // On mobile/iframe, close the sidebar to show the map
      if ((isMobile || isInIframe) && !isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
        // Mark as user interaction to prevent auto-show
        safeStorage.setItem("gb-map-user-interacted", "true");
      }
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSearch = async () => {
    setSearchStatus(t("status.searching"));
    // Yield to browser so the UI can paint "Searching..." before heavy work
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const results = await runSearch(searchQuery, 50, premiumFilter);
      const resultCount = results ? results.length : 0;
      setSearchStatus(t("status.foundResults", { count: resultCount }));
    } catch (error) {
      setSearchStatus(t("status.error"));
    }
  };

  // Debounced filter processing to avoid rapid re-renders
  const processFilteredLocations = useCallback(
    debounce(async (premiumVal, countryVal, regionVal) => {
      if (searchResults.length === 0) return;

      setIsSearching(true);
      setLoading(true);
      setSearchStatus(t("status.searching"));

      try {
        // Apply filtering logic
        const filteredLocations = allLocations.filter((loc) => {
          if (premiumVal === "premium" && !loc.fields[IS_PREMIUM_FIELD_ID]) {
            return false;
          }
          if (countryVal !== "all" && loc.fields[COUNTRY_FIELD_ID] !== countryVal) {
            return false;
          }
          if (regionVal !== "all") {
            const region = loc.fields[REGION_FIELD_ID];
            if (Array.isArray(region)) {
              if (!region.includes(regionVal)) return false;
            } else if (region !== regionVal) {
              return false;
            }
          }
          return true;
        });

        // Sort by name
        const sortedLocations = filteredLocations.sort((a, b) => {
          const nameA = a.fields[ADDRESS_FIELD_ID] || "";
          const nameB = b.fields[ADDRESS_FIELD_ID] || "";
          return nameA.localeCompare(nameB);
        });

        // Process locations
        const processedLocations = sortedLocations.map((location, index) => {
          const uniqueId = `${location.id || ""}-${index}-${
            location.fields[ADDRESS_FIELD_ID] || ""
          }`.replace(/[^a-zA-Z0-9]/g, "-");

          return {
            ...location,
            uniqueId,
            coordinates: [
              parseFloat(location.fields[LONGITUDE_FIELD_ID]),
              parseFloat(location.fields[LATITUDE_FIELD_ID]),
            ],
          };
        });

        setSearchResults(processedLocations);
        setSearchStatus(t("status.foundResults", { count: sortedLocations.length }));
      } catch (error) {
        setSearchStatus(t("status.error"));
      } finally {
        setLoading(false);
        setIsSearching(false);
      }
    }, 300), // 300ms debounce delay
    [allLocations, searchResults.length, t, IS_PREMIUM_FIELD_ID, COUNTRY_FIELD_ID, REGION_FIELD_ID, ADDRESS_FIELD_ID, LONGITUDE_FIELD_ID, LATITUDE_FIELD_ID]
  );

  const handleFilterChange = (filterType, value) => {
    // Update state immediately for UI responsiveness
    if (filterType === "premium") {
      setPremiumFilter(value);
      // Trigger debounced filtering with new value
      processFilteredLocations(value, countryFilter, regionFilter);
    } else if (filterType === "country") {
      setCountryFilter(value);
      // Trigger debounced filtering with new value
      processFilteredLocations(premiumFilter, value, regionFilter);
    }
  };

  const showAllLocations = async () => {
    if (!mapInstance.current || !mapInitialized) {
      setSearchStatus(t("status.loading"));
      return;
    }

    setSearchStatus(t("status.loadingLocations"));
    setIsSearching(true);
    setLoading(true);
    try {
      // Fetch all locations and use returned data directly (not stale state)
      const freshLocations = await fetchLocations(true);

      // Get the filtered locations
      const filteredLocations = (freshLocations || []).filter((loc) => {
        // Apply the same filters that are used in filterAndDisplayLocations
        if (premiumFilter === "premium" && !loc.fields[IS_PREMIUM_FIELD_ID]) {
          return false;
        }
        if (
          countryFilter !== "all" &&
          loc.fields[COUNTRY_FIELD_ID] !== countryFilter
        ) {
          return false;
        }
        if (regionFilter !== "all") {
          const region = loc.fields[REGION_FIELD_ID];
          if (Array.isArray(region)) {
            if (!region.includes(regionFilter)) return false;
          } else if (region !== regionFilter) {
            return false;
          }
        }
        return true;
      });

      // Sort by name (using address field as name)
      const sortedLocations = filteredLocations.sort((a, b) => {
        const nameA = a.fields[ADDRESS_FIELD_ID] || "";
        const nameB = b.fields[ADDRESS_FIELD_ID] || "";
        return nameA.localeCompare(nameB);
      });

      // Process locations to add uniqueId and other required properties for the UI
      const processedLocations = sortedLocations.map((location, index) => {
        const uniqueId = `${location.id || ""}-${index}-${
          location.fields[ADDRESS_FIELD_ID] || ""
        }`.replace(/[^a-zA-Z0-9]/g, "-");

        return {
          ...location,
          uniqueId,
          coordinates: [
            parseFloat(location.fields[LONGITUDE_FIELD_ID]),
            parseFloat(location.fields[LATITUDE_FIELD_ID]),
          ],
        };
      });

      setSearchResults(processedLocations);
      setIsResultsVisible(true);
      setSearchStatus(
        t("status.foundResults", { count: sortedLocations.length })
      );
    } catch (error) {
      setSearchStatus(t("status.error"));
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  // Add this cleanup function to component unmount
  useEffect(() => {
    return () => {
      // Clean up markers when component unmounts
      if (searchResults.length > 0) {
        searchResults.forEach((result) => {
          if (result.marker) {
            result.marker.remove();
          }
        });
      }
    };
  }, [searchResults]);

  // Mobile detection and responsive handling
  useEffect(() => {
    const checkMobile = () => {
      // Check if we're in an iframe
      const inIframe = window.self !== window.top;
      setIsInIframe(inIframe);

      // Get the actual viewport size (considering iframe context)
      let viewportWidth = window.innerWidth;
      let viewportHeight = window.innerHeight;

      // If in iframe, try to get parent window dimensions
      if (inIframe) {
        try {
          // Try to access parent window dimensions
          if (window.parent && window.parent !== window) {
            viewportWidth = window.parent.innerWidth || window.innerWidth;
            viewportHeight = window.parent.innerHeight || window.innerHeight;
          }
        } catch (e) {
          // Cross-origin iframe, use current window dimensions
          viewportWidth = window.innerWidth;
          viewportHeight = window.innerHeight;
        }
      }

      // Enhanced mobile detection
      const isMobileDevice =
        viewportWidth <= 768 ||
        viewportHeight <= 600 || // Consider height for landscape mobile
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) ||
        "ontouchstart" in window || // Touch capability
        navigator.maxTouchPoints > 0; // Touch points

      setIsMobile(isMobileDevice);

      // Force mobile layout for very small iframes
      if (viewportWidth <= 480 || viewportHeight <= 400) {
        setIsMobile(true);
      }

      // Additional check: if iframe is very small, force mobile
      if (inIframe && (window.innerWidth <= 400 || window.innerHeight <= 300)) {
        setIsMobile(true);
      }

      // Detect Chrome emulator
      const isChromeEmulator =
        /Chrome/.test(navigator.userAgent) &&
        (window.innerWidth <= 768 || window.innerHeight <= 600) &&
        !("ontouchstart" in window);
      setIsChromeEmulator(isChromeEmulator);
    };

    // Initial check
    checkMobile();

    // Listen for resize events on both current window and parent
    window.addEventListener("resize", checkMobile);

    // If in iframe, also listen to parent window resize
    if (window.parent && window.parent !== window) {
      try {
        window.parent.addEventListener("resize", checkMobile);
      } catch (e) {
        // Cross-origin, can't access parent
      }
    }

    // Fallback: check again after a short delay to catch any missed updates
    const fallbackCheck = setTimeout(checkMobile, 100);

    return () => {
      clearTimeout(fallbackCheck);
      window.removeEventListener("resize", checkMobile);
      if (window.parent && window.parent !== window) {
        try {
          window.parent.removeEventListener("resize", checkMobile);
        } catch (e) {
          // Cross-origin, can't access parent
        }
      }
    };
  }, []);

  // Simplified touch handling for mobile sidebar - prevent crashes
  const handleTouchStart = useCallback((e) => {
    if (!isMobile && !isInIframe) return;
    try {
      setTouchStartY(e.touches[0]?.clientY || 0);
      setTouchStartX(e.touches[0]?.clientX || 0);
      setIsDragging(false);
    } catch (error) {
      console.warn('Touch start error:', error);
    }
  }, [isMobile, isInIframe]);

  const handleTouchMove = useCallback((e) => {
    if (!isMobile && !isInIframe || !e.touches?.[0]) return;

    try {
      const touchY = e.touches[0].clientY;
      const touchX = e.touches[0].clientX;
      const deltaY = touchY - touchStartY;
      const deltaX = Math.abs(touchX - touchStartX);

      // Only handle vertical swipes with significant movement
      if (deltaX > 30 || Math.abs(deltaY) < 20) return;

      setIsDragging(true);

      // Simple swipe gestures - avoid complex logic that can crash
      if (deltaY > 80 && !isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
        setIsDragging(false);
        safeStorage.setItem("gb-map-user-interacted", "true");
      } else if (deltaY < -80 && isSidebarCollapsed) {
        setIsSidebarCollapsed(false);
        setIsDragging(false);
      }
    } catch (error) {
      console.warn('Touch move error:', error);
      setIsDragging(false);
    }
  }, [isMobile, isInIframe, touchStartY, touchStartX, isSidebarCollapsed]);

  const handleTouchEnd = useCallback((e) => {
    if (!isMobile && !isInIframe) return;
    try {
      setIsDragging(false);
    } catch (error) {
      console.warn('Touch end error:', error);
    }
  }, [isMobile, isInIframe]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if ((isMobile || isInIframe) && !isSidebarCollapsed) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobile, isInIframe, isSidebarCollapsed]);

  // Auto-show sidebar on mobile/iframe when map loads (only once)
  useEffect(() => {
    if ((isMobile || isInIframe) && mapInitialized && isSidebarCollapsed) {
      // Only auto-show if this is the first time the map loads
      // Don't auto-show if user has manually closed it
      // Be more conservative in Chrome emulator
      const hasUserInteracted = safeStorage.getItem("gb-map-user-interacted");
      const isFirstLoad = !hasUserInteracted;

      if (isFirstLoad && !isChromeEmulator) {
        setTimeout(() => {
          setIsSidebarCollapsed(false);
        }, 300);
      }
    }
  }, [isMobile, isInIframe, mapInitialized, isChromeEmulator]);

  // Track user interaction to prevent auto-show after manual close
  useEffect(() => {
    if (isSidebarCollapsed) {
      safeStorage.setItem("gb-map-user-interacted", "true");
    }
  }, [isSidebarCollapsed]);

  // Toggle sidebar function
  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
    // Mark as user interaction to prevent auto-show
    safeStorage.setItem("gb-map-user-interacted", "true");
  };

  return (
    <div
      className={`${styles.luxuryContainer} ${
        isMobile || isInIframe ? styles.mobileContainer : ""
      } ${isInIframe ? styles.iframeMobile : ""}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating Toggle Button for Mobile */}
      {(isMobile || isInIframe) && (
        <button
          className={`${styles.floatingToggle} ${
            isSidebarCollapsed ? styles.floatingToggleCollapsed : ""
          }`}
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          {isSidebarCollapsed ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12h18M3 6h18M3 18h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      )}

      {/* Chrome Emulator Debug Info */}
      {isChromeEmulator && (
        <div className={styles.debugInfo}>
          <p>Chrome Emulator Mode - Sidebar won't auto-show</p>
        </div>
      )}
      {/* Loading Overlay */}
      {(isSearching || loading || isInitialLoading) && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContent}>
            <Image
              src="/gracie_shield.png"
              alt="Gracie Barra"
              width={80}
              height={80}
              className={styles.loadingLogo}
              priority
            />
            <p className={styles.loadingText}>
              {isSearching ? t("status.searching") : t("status.loading")}
            </p>
          </div>
        </div>
      )}

      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      {/* Luxury Sidebar */}
      <div
        className={`${styles.luxurySidebar} ${
          isMobile || isInIframe ? styles.mobileSidebar : ""
        } ${isSidebarCollapsed ? styles.sidebarCollapsed : ""} ${
          isDragging ? styles.sidebarDragging : ""
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className={styles.sidebarHeader}>
          <div className={styles.logoContainer}>
            <Image
              src="/gracie_shield.png"
              alt="Gracie Barra Logo"
              width={50}
              height={50}
              className={styles.logo}
              priority
            />
            <div className={styles.titleContainer}>
              <h1 className={styles.sidebarTitle}>{t("header.title")}</h1>
              <p className={styles.sidebarSubtitle}>{t("header.subtitle")}</p>
            </div>
          </div>
          {/* Header Actions */}
          <div className={styles.headerActions}>
            <div className={styles.languageSelector}>
              <select
                value={locale}
                onChange={(e) => changeLanguage(e.target.value)}
                className={styles.languageSelect}
                title="Select language"
              >
                {availableLocales.map((lang) => (
                  <option key={lang} value={lang}>
                    {t(`languages.${lang}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Compact Search & Filters */}
        <div className={styles.compactSearchSection}>
          {/* Search Bar */}
          <div className={styles.searchBar}>
            <div className={styles.searchInputWrapper}>
              <div className={styles.searchIcon}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle key="search-circle" cx="11" cy="11" r="8"></circle>
                  <path key="search-handle" d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <input
                type="text"
                placeholder={t("search.placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className={styles.compactSearchInput}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className={styles.searchButton}
                title={t("search.button")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </button>
            </div>
            <button
              onClick={getUserLocation}
              disabled={loading}
              className={styles.locationButton}
              title={t("search.locationButton")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path key="location-pin" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle key="location-dot" cx="12" cy="10" r="3"></circle>
              </svg>
            </button>
          </div>

          {/* Compact Filters */}
          <div className={styles.compactFilters}>
            <div className={styles.filterRow}>
              <select
                value={premiumFilter}
                onChange={(e) => handleFilterChange("premium", e.target.value)}
                className={styles.compactFilter}
                title="Filter by location type (All locations or Premium only)"
              >
                {getPremiumOptions(t).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={countryFilter}
                onChange={(e) => handleFilterChange("country", e.target.value)}
                className={styles.compactFilter}
                title="Filter by country to show locations in specific countries"
              >
                {getCountryOptions(uniqueCountries, t).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                onClick={showAllLocations}
                disabled={isSearching}
                className={styles.showAllButton}
                title={t("search.showAll")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle key="globe-circle" cx="12" cy="12" r="10"></circle>
                  <path key="globe-horizontal" d="M2 12h20"></path>
                  <path key="globe-vertical" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className={styles.resultsSection}>
          <div className={styles.resultsHeader}>
            <h3 className={styles.sectionTitle}>
              {isInitialLoading || loading
                ? t("results.title")
                : t("results.titleWithCount", {
                    count: searchResults ? searchResults.length : 0,
                  })}
            </h3>
          </div>

          <div className={styles.luxuryResultsList}>
            {searchResults && searchResults.length > 0 ? (
              searchResults.map((result) => (
                <div
                  key={result.uniqueId}
                  className={`${styles.luxuryResultItem} ${
                    activeCard === result.uniqueId ? styles.activeResult : ""
                  }`}
                  onClick={(e) => handleResultItemClick(result, e)}
                  onKeyDown={(e) => handleKeyDown(e, result)}
                  tabIndex={0}
                  style={{
                    opacity: (loading || isInitialLoading) ? 0.5 : 1,
                    pointerEvents: (loading || isInitialLoading) ? 'none' : 'auto',
                    cursor: (loading || isInitialLoading) ? 'wait' : 'pointer'
                  }}
                  role="button"
                  aria-label={`${
                    (result.fields &&
                      (result.fields[GB_NAME_FIELD_ID] ||
                        result.fields[SCHOOL_FIELD_ID] ||
                        result.fields[ADDRESS_FIELD_ID])) ||
                    "Location"
                  } - ${
                    result.distance
                      ? `${result.distance.toFixed(1)} miles away`
                      : ""
                  }`}
                >
                  <div className={styles.resultItemHeader}>
                    <h4 className={styles.resultItemTitle}>
                      {(() => {
                        if (!result.fields) return "Location";

                        const schoolName =
                          result.fields[GB_NAME_FIELD_ID] ||
                          result.fields[SCHOOL_FIELD_ID];
                        return (
                          schoolName ||
                          result.fields[ADDRESS_FIELD_ID] ||
                          "Location"
                        );
                      })()}
                    </h4>
                    {result.fields && result.fields[IS_PREMIUM_FIELD_ID] && (
                      <span className={styles.luxuryPremiumBadge}>{t("location.premium")}</span>
                    )}
                  </div>
                  <div className={styles.resultItemDetails}>
                    <p className={styles.resultItemAddress}>
                      {result.fields
                        ? result.fields[ADDRESS_FIELD_ID]
                        : "Address not available"}
                    </p>
                    {result.distance && (
                      <p className={styles.resultItemDistance}>
                        {result.distance.toFixed(1)} miles away
                      </p>
                    )}
                    {result.fields && result.fields[PHONE_FIELD_ID] && (
                      <p className={styles.resultItemPhone}>
                        📞 {formatPhoneNumber(result.fields[PHONE_FIELD_ID])}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.noResults}>
                <p>{t("results.noResults")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Search Status */}
        {searchStatus && (
          <div className={styles.luxurySearchStatus}>{searchStatus}</div>
        )}

        {/* Error Messages */}
        {locationError && (
          <div className={styles.luxuryErrorMessage} role="alert">
            <p>{locationError}</p>
            {locationError.includes("Unable to") && !isRetrying && (
              <button
                onClick={getUserLocation}
                className={styles.retryButton}
                disabled={loading}
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full Height Map */}
      <div
        className={`${styles.luxuryMapWrapper} ${
          isSidebarCollapsed ? styles.sidebarCollapsed : ""
        }`}
      >
        <div id="main-content" ref={mapContainer} className={styles.luxuryMapContainer} role="application" aria-label="Gracie Barra school locations map" />
        {isMapLoading && (
          <div className={styles.mapOverlay}>
            <div className={styles.mapLoading}>
              <p>Loading map...</p>
            </div>
          </div>
        )}
        {mapError && !isMapLoading && (
          <div className={styles.mapOverlay}>
            <div className={styles.mapError}>
              <p>{mapError}</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Component;
