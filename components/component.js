import React, { useEffect, useState, useCallback, useRef } from "react";
import mapboxgl from "mapbox-gl";
import mapboxSdk from "@mapbox/mapbox-sdk/services/geocoding";
import Modal from "react-modal";
import styles from "../styles/style.module.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Image from "next/image";

// Airtable setup
const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.NEXT_PUBLIC_AIRTABLE_TABLE_ID;
const AIRTABLE_VIEW_ID = process.env.NEXT_PUBLIC_AIRTABLE_VIEW_ID;
const LATITUDE_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_LATITUDE_FIELD_ID;
const LONGITUDE_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_LONGITUDE_FIELD_ID;
const ADDRESS_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_ADDRESS_FIELD_ID;
const SCHOOL_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_SCHOOL_FIELD_ID;

// SCHOOL_FIELD_ID loaded from environment
const HEAD_INSTRUCTOR_FIELD_ID =
  process.env.NEXT_PUBLIC_AIRTABLE_HEAD_INSTRUCTOR_FIELD_ID;
const PHONE_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_PHONE_FIELD_ID;
const EMAIL_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_EMAIL_FIELD_ID;
const WEBSITE_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_WEBSITE_FIELD_ID;
const IS_PREMIUM_FIELD_ID =
  process.env.NEXT_PUBLIC_AIRTABLE_IS_PREMIUM_FIELD_ID;
const COUNTRY_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_COUNTRY_FIELD_ID;
const REGION_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_REGION_FIELD_ID;

// Mapbox access token
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Set the access token for mapboxgl
if (typeof window !== "undefined") {
  if (!MAPBOX_TOKEN) {
    console.error("Mapbox token is missing!");
  } else {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapboxgl.workerClass = null; // Disable worker to avoid cross-origin issues
  }
}

// Set the token for the geocoding client
const mapboxClient = mapboxSdk({ accessToken: MAPBOX_TOKEN });

// Default center coordinates (Riverside, CA)
const DEFAULT_CENTER = [-117.3755, 33.9806];

const radiusOptions = [
  { value: 10, label: "10 miles" },
  { value: 25, label: "25 miles" },
  { value: 50, label: "50 miles" },
  { value: 100, label: "100 miles" },
  { value: "any", label: "Any distance" },
];

const premiumOptions = [
  { value: "all", label: "All locations" },
  { value: "premium", label: "Premium only" },
];

const countryOptions = (countries) => [
  { value: "all", label: "All countries" },
  ...countries.map((country) => ({ value: country, label: country })),
];

const regionOptions = (regions) => [
  { value: "all", label: "All regions" },
  ...regions.map((region) => ({ value: region, label: region })),
];

// Custom Modal styles to override react-modal default styles
const customModalStyles = (pinColor) => ({
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    zIndex: 1000, // Ensure modal overlay is above other content
  },
  content: {
    position: "relative",
    inset: 0,
    margin: "auto",
    width: "70%",
    maxWidth: "90%",
    borderRadius: "12px",
    padding: "30px",
    backgroundColor: "#fff",
    border: `3px solid ${pinColor}`, // Set border color to match pin color
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)", // Custom box shadow
  },
});

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

// Add this helper function near the top with other utility functions
const isStateSearch = (placeName, placeType) => {
  const usStates = [
    "alabama",
    "alaska",
    "arizona",
    "arkansas",
    "california",
    "colorado",
    "connecticut",
    "delaware",
    "florida",
    "georgia",
    "hawaii",
    "idaho",
    "illinois",
    "indiana",
    "iowa",
    "kansas",
    "kentucky",
    "louisiana",
    "maine",
    "maryland",
    "massachusetts",
    "michigan",
    "minnesota",
    "mississippi",
    "missouri",
    "montana",
    "nebraska",
    "nevada",
    "new hampshire",
    "new jersey",
    "new mexico",
    "new york",
    "north carolina",
    "north dakota",
    "ohio",
    "oklahoma",
    "oregon",
    "pennsylvania",
    "rhode island",
    "south carolina",
    "south dakota",
    "tennessee",
    "texas",
    "utah",
    "vermont",
    "virginia",
    "washington",
    "west virginia",
    "wisconsin",
    "wyoming",
  ];
  return (
    placeType.includes("region") && usStates.includes(placeName.toLowerCase())
  );
};

// Add state bounding boxes near the top with other constants
const STATE_BOUNDS = {
  arizona: [-114.8183, 31.3322, -109.0452, 37.0043], // [minLng, minLat, maxLng, maxLat]
  // Add other states as needed
};

// Helper function to check if a point is within bounds
const isPointWithinBounds = (point, bounds) => {
  const [lng, lat] = point;
  const [minLng, minLat, maxLng, maxLat] = bounds;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
};

// Use default Mapbox popup positioning - no custom offsets
const calculatePopupOffset = () => {
  // Return default offset for perfect pin alignment
  return [0, 0];
};

// Make popup draggable
const makePopupDraggable = (popupContent, popup) => {
  let isDragging = false;
  let startX, startY, initialOffsetX, initialOffsetY;
  let animationFrame = null;

  // Add drag handle to the header - look for the draggable header
  const header = popupContent.querySelector("[data-draggable='true']");
  if (!header) {
    console.log("Header not found for dragging");
    return;
  }

  console.log("Setting up drag functionality for popup");

  // Add cursor style to indicate draggable
  header.style.cursor = "grab";
  header.style.userSelect = "none";
  header.style.touchAction = "none"; // Prevent scrolling on touch devices

  const startDrag = (e) => {
    console.log("Drag started");
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
    console.log("Drag ended");
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
  const mapContainer = React.useRef(null);
  const mapInstance = React.useRef(null);
  const userMarkerRef = React.useRef(null);
  const [map, setMap] = useState(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  // Modal states removed - using small popup system instead
  const [instructorModalIsOpen, setInstructorModalIsOpen] = useState(false);
  const [instructorData, setInstructorData] = useState(null);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchRadius, setSearchRadius] = useState(50);
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
  const [locationCache, setLocationCache] = useState(new Map());
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const searchResultsRef = useRef(null);
  const mapRef = useRef(null);

  // First, define createLocationPopupContent with useCallback
  const createLocationPopupContent = useCallback((location) => {
    if (!location || typeof location !== "object") {
      return "";
    }

    // Handle both cases: fields at top level or nested under .fields
    const fields = location.fields || location;

    const isPremium = fields[IS_PREMIUM_FIELD_ID] || false;
    // Try multiple possible school name fields
    const schoolName =
      fields[SCHOOL_FIELD_ID] ||
      fields["School Name"] ||
      fields["Name"] ||
      fields["Title"] ||
      fields["Location Name"] ||
      null;

    const locationName =
      schoolName || fields[ADDRESS_FIELD_ID] || "School Name Not Available";
    const fullAddress = fields[ADDRESS_FIELD_ID] || "Address Not Available";
    const instructor =
      fields[HEAD_INSTRUCTOR_FIELD_ID] || "Instructor Not Available";
    const phone = fields[PHONE_FIELD_ID];
    const formattedPhone =
      typeof phone === "string" ? phone : "Phone Not Available";
    const phoneDigits =
      typeof phone === "string" ? phone.replace(/[^0-9]/g, "") : "";
    const email = fields[EMAIL_FIELD_ID];
    const website = fields[WEBSITE_FIELD_ID];
    const locationId = location.id || `${locationName}-${fullAddress}`;

    const premiumDescription =
      "Gracie Barra Premium Schools are academies that meet a higher standard of excellence within the Gracie Barra network. These schools go beyond the basic operational standards, reflecting the highest level of compliance with Gracie Barra's methodology, facilities, and service quality.";

    return `
      <div class="${styles.locationCard}" data-location-id="${locationId}">
        <div class="${styles.locationHeader}" data-draggable="true">
          <div class="${styles.dragHandle}">⋮⋮</div>
          <h3>${locationName}</h3>
          <button class="${
            styles.closeButton
          }" onclick="this.closest('.mapboxgl-popup').remove()" aria-label="Close popup">×</button>
          <div class="${styles.locationBadge} ${
      isPremium ? styles.premiumBadge : styles.regularBadge
    }">
            ${isPremium ? "Premium Location" : "Gracie Barra Location"}
          </div>
          ${
            isPremium
              ? `
            <div class="${styles.premiumDescription}">
              ${premiumDescription}
            </div>
          `
              : ""
          }
        </div>
        
        <div class="${styles.locationContent}">
          <div class="${styles.locationInfo}">
            <h4>Address</h4>
            <p>${fullAddress}</p>
          </div>
          
          <div class="${styles.locationInfo}">
            <h4>Instructor</h4>
            <p>${instructor}</p>
          </div>
          
          <div class="${styles.locationInfo}">
            <h4>Phone</h4>
            <p>${formattedPhone}</p>
          </div>
          
          ${
            email
              ? `
          <div class="${styles.locationInfo}">
            <h4>Email</h4>
            <p>${email}</p>
          </div>
          `
              : ""
          }
          
          <div class="${styles.locationLinks}">
            ${
              website
                ? `
              <a href="${website}" target="_blank" rel="noopener noreferrer" class="${styles.actionButton}">
                Visit Website
              </a>
            `
                : ""
            }
            ${
              email
                ? `
              <a href="mailto:${email}" class="${styles.actionButton}">
                Email School
              </a>
            `
                : ""
            }
            ${
              phoneDigits
                ? `
              <a href="tel:${phoneDigits}" class="${styles.actionButton}">
                Call Now
              </a>
            `
                : ""
            }
            <a href="https://maps.google.com/?q=${encodeURIComponent(
              fullAddress
            )}" target="_blank" rel="noopener noreferrer" class="${
      styles.actionButton
    }">
              Get Directions
            </a>
          </div>
        </div>
      </div>
    `;
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
      if (!locationData || !coordinates || !mapInstance.current) {
        console.log("Missing required data for popup:", {
          locationData,
          coordinates,
          mapInstance: !!mapInstance.current,
        });
        return;
      }

      // First, close all existing popups
      closeAllPopups();

      try {
        // Create and open new popup
        const newPopup = new mapboxgl.Popup({
          closeButton: false, // Use custom close button instead
          maxWidth: "600px", // Much wider to prevent cut-off
          closeOnClick: false,
          // No offset - use default Mapbox positioning for perfect pin alignment
        });

        const content = createLocationPopupContent(locationData);
        if (!content) {
          console.log("No content generated for popup");
          return;
        }

        newPopup
          .setLngLat(coordinates)
          .setHTML(content)
          .addTo(mapInstance.current);

        // Add drag functionality to popup
        setTimeout(() => {
          const popupElement = newPopup.getElement();
          if (popupElement) {
            const popupContent = popupElement.querySelector(
              ".mapboxgl-popup-content"
            );
            if (popupContent) {
              makePopupDraggable(popupContent, newPopup);
            }
          }
        }, 100);

        // Set up close handler
        newPopup.on("close", () => {
          console.log("Popup close event triggered");
          setActivePopup(null);
          setActiveCard(null);
          setShowLocationDetails(false);
        });

        // Update states
        setActivePopup(newPopup);
        setActiveCard(locationId);
        setShowLocationDetails(true);
      } catch (error) {
        console.error("Error creating popup:", error);
      }
    },
    [mapInstance, createLocationPopupContent, closeAllPopups]
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
      const address = loc.fields["Address for Geolocation"];
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
        console.log(
          `Processing location: ${loc.fields[ADDRESS_FIELD_ID]} with coordinates:`,
          coords
        );
        return {
          ...loc,
          coordinates: coords,
        };
      });

    console.log("Direct locations with coordinates:", directLocations.length);

    // Only geocode locations without coordinates
    const locationsToGeocode = validLocations.filter(
      (loc) => !loc.fields[LONGITUDE_FIELD_ID] || !loc.fields[LATITUDE_FIELD_ID]
    );

    // First check cache for locations that need geocoding
    const uncachedLocations = locationsToGeocode.filter(
      (loc) => !locationCache.has(loc.fields["School Address"])
    );

    if (uncachedLocations.length === 0) {
      const geocodedLocations = locationsToGeocode.map((loc) => ({
        ...loc,
        coordinates: locationCache.get(loc.fields["School Address"]),
      }));
      return [...directLocations, ...geocodedLocations];
    }

    // Process remaining locations that need geocoding
    try {
      const batchSize = 5;
      const batches = [];

      for (let i = 0; i < uncachedLocations.length; i += batchSize) {
        batches.push(uncachedLocations.slice(i, i + batchSize));
      }

      const results = await Promise.all(
        batches.map(async (batch) => {
          const batchPromises = batch.map(async (location) => {
            const address = location.fields["School Address"].trim();

            try {
              const response = await mapboxClient
                .forwardGeocode({
                  query: address,
                  limit: 1,
                  types: ["address", "place", "poi"],
                  language: ["en"],
                  autocomplete: false,
                  fuzzyMatch: false,
                })
                .send();

              if (response.body.features.length) {
                const coords = response.body.features[0].center;
                setLocationCache((prev) => new Map(prev).set(address, coords));
                return { ...location, coordinates: coords };
              }
            } catch (error) {
              console.error(`Error geocoding address: ${address}`, error);
            }
            return null;
          });

          const batchResults = await Promise.all(batchPromises);
          return batchResults.filter(Boolean);
        })
      );

      // Add cached locations
      const cachedResults = locationsToGeocode
        .filter((loc) =>
          locationCache.has(loc.fields["Address for Geolocation"])
        )
        .map((loc) => ({
          ...loc,
          coordinates: locationCache.get(loc.fields["Address for Geolocation"]),
        }));

      // Combine direct coordinates with geocoded results
      return [...directLocations, ...results.flat(), ...cachedResults];
    } catch (error) {
      console.error("Error in batch geocoding:", error);
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

  // Update the fetchLocations function to improve caching
  const fetchLocations = async (forceRefresh = false) => {
    let allRecords = [];
    let offset = null;

    // Define the fields we need for the map using field IDs
    // Only include fields that are defined in environment variables
    const fields = [];

    if (ADDRESS_FIELD_ID) fields.push(ADDRESS_FIELD_ID);
    if (SCHOOL_FIELD_ID) fields.push(SCHOOL_FIELD_ID);
    if (HEAD_INSTRUCTOR_FIELD_ID) fields.push(HEAD_INSTRUCTOR_FIELD_ID);
    if (PHONE_FIELD_ID) fields.push(PHONE_FIELD_ID);
    if (EMAIL_FIELD_ID) fields.push(EMAIL_FIELD_ID);
    if (WEBSITE_FIELD_ID) fields.push(WEBSITE_FIELD_ID);
    if (IS_PREMIUM_FIELD_ID) fields.push(IS_PREMIUM_FIELD_ID);
    if (COUNTRY_FIELD_ID) fields.push(COUNTRY_FIELD_ID);
    if (REGION_FIELD_ID) fields.push(REGION_FIELD_ID);
    if (LATITUDE_FIELD_ID) fields.push(LATITUDE_FIELD_ID);
    if (LONGITUDE_FIELD_ID) fields.push(LONGITUDE_FIELD_ID);

    const fieldsParam = fields
      .map((field) => `fields[]=${encodeURIComponent(field)}`)
      .join("&");

    console.log("Requesting fields:", fields);
    console.log("Fields param:", fieldsParam);

    try {
      // Debug environment variables
      console.log("Environment Variables Check:", {
        AIRTABLE_BASE_ID: AIRTABLE_BASE_ID,
        AIRTABLE_TABLE_ID: AIRTABLE_TABLE_ID,
        AIRTABLE_VIEW_ID: AIRTABLE_VIEW_ID,
        AIRTABLE_API_KEY: AIRTABLE_API_KEY
          ? `${AIRTABLE_API_KEY.substring(0, 10)}...`
          : "MISSING",
        LATITUDE_FIELD_ID: LATITUDE_FIELD_ID,
        LONGITUDE_FIELD_ID: LONGITUDE_FIELD_ID,
      });

      // First try to get from cache
      const cacheKey = `${AIRTABLE_BASE_ID}-${AIRTABLE_TABLE_ID}-${AIRTABLE_VIEW_ID}`;
      const cachedData = localStorage.getItem(cacheKey);
      const cacheTimestamp = localStorage.getItem(`${cacheKey}-timestamp`);

      // Check if cache is valid (less than 5 minutes old) and not forcing refresh
      if (
        !forceRefresh &&
        cachedData &&
        cacheTimestamp &&
        Date.now() - parseInt(cacheTimestamp) < 300000
      ) {
        console.log("Using cached location data");
        return JSON.parse(cachedData);
      }

      // Clear old cache if forcing refresh
      if (forceRefresh) {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}-timestamp`);
        console.log("Forcing refresh of location data");
      }

      do {
        let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?view=${AIRTABLE_VIEW_ID}&returnFieldsByFieldId=true&${fieldsParam}`;

        if (offset) {
          url += `&offset=${offset}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error("Airtable API Error Details:", {
            status: response.status,
            statusText: response.statusText,
            url: url,
            baseId: AIRTABLE_BASE_ID,
            tableId: AIRTABLE_TABLE_ID,
            viewId: AIRTABLE_VIEW_ID,
          });
          throw new Error(
            `Airtable API error: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        // Debug logs removed - data fetching working correctly

        const validRecords = data.records.filter(
          (record) =>
            record.fields[LONGITUDE_FIELD_ID] &&
            record.fields[LATITUDE_FIELD_ID]
        );

        console.log("Valid records with coordinates:", validRecords.length);
        console.log("Sample valid record:", validRecords[0]);
        console.log("Field ID check:", {
          LONGITUDE_FIELD_ID: LONGITUDE_FIELD_ID,
          LATITUDE_FIELD_ID: LATITUDE_FIELD_ID,
          SCHOOL_FIELD_ID: SCHOOL_FIELD_ID,
          hasLongitude: data.records[0]?.fields[LONGITUDE_FIELD_ID],
          hasLatitude: data.records[0]?.fields[LATITUDE_FIELD_ID],
          hasSchool: data.records[0]?.fields[SCHOOL_FIELD_ID],
          schoolValue: data.records[0]?.fields[SCHOOL_FIELD_ID],
        });

        allRecords = [...allRecords, ...validRecords];
        offset = data.offset;
      } while (offset);

      // Cache the results with a shorter expiration
      localStorage.setItem(cacheKey, JSON.stringify(allRecords));
      localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());

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
      console.error("Error fetching data from Airtable:", error);
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

  // Convert coordinates to an address using Mapbox reverse geocoding
  const reverseGeocode = async (coords) => {
    try {
      if (!coords || !Array.isArray(coords) || coords.length !== 2) {
        throw new Error("Invalid coordinates provided");
      }

      const response = await mapboxClient
        .reverseGeocode({
          query: coords,
          limit: 1,
        })
        .send();

      if (response.body.features.length) {
        return response.body.features[0].place_name;
      }
      return `${coords[1]}, ${coords[0]}`; // Fallback to coords if no address is found
    } catch (error) {
      console.error("Error reverse geocoding:", error);
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
        console.error("Map not initialized");
        return;
      }

      try {
        console.log("Attempting to add user marker at:", coordinates);

        // Validate coordinates
        if (
          !coordinates ||
          !Array.isArray(coordinates) ||
          coordinates.length !== 2 ||
          !isFinite(coordinates[0]) ||
          !isFinite(coordinates[1])
        ) {
          console.error("Invalid coordinates:", coordinates);
          return;
        }

        // Ensure coordinates are within valid range
        const lng = ((coordinates[0] + 180) % 360) - 180;
        const lat = Math.max(-90, Math.min(90, coordinates[1]));

        // Remove existing user marker
        removeUserMarker();

        console.log("Creating user marker at coordinates:", [lng, lat]);

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

        console.log("User marker added successfully at:", [lng, lat]);
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
          await runSearch([longitude, latitude], searchRadius, premiumFilter);
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

      // Clear existing markers
      const existingMarkers = document.querySelectorAll(".mapboxgl-marker");
      existingMarkers.forEach((marker) => marker.remove());

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
        setSearchStatus("Found 0 locations");
        return;
      }

      // Add markers to map
      const bounds = new mapboxgl.LngLatBounds();
      geocodedLocations.forEach((location, index) => {
        if (location.coordinates && location.coordinates.length === 2) {
          const isPremium = location.fields[IS_PREMIUM_FIELD_ID];
          const marker = new mapboxgl.Marker({
            color: isPremium ? "#FFD700" : "#FF0000",
            scale: isPremium ? 1.2 : 1,
          })
            .setLngLat(location.coordinates)
            .addTo(mapInstance.current);

          bounds.extend(location.coordinates);

          const uniqueId = `${location.id || ""}-${index}-${
            location.fields[ADDRESS_FIELD_ID] || ""
          }`.replace(/[^a-zA-Z0-9]/g, "-");

          marker.getElement().addEventListener("click", (e) => {
            e.stopPropagation();

            // Close any existing popups first
            closeAllPopups();

            // Create and open popup
            const popup = new mapboxgl.Popup({
              closeButton: false, // Use custom close button instead
              maxWidth: "600px", // Much wider to prevent cut-off
              closeOnClick: false,
              // No offset - use default Mapbox positioning for perfect pin alignment
            });

            const content = createLocationPopupContent(location);
            if (content) {
              popup
                .setLngLat(location.coordinates)
                .setHTML(content)
                .addTo(mapInstance.current);

              // Add drag functionality to popup
              setTimeout(() => {
                const popupElement = popup.getElement();
                if (popupElement) {
                  const popupContent = popupElement.querySelector(
                    ".mapboxgl-popup-content"
                  );
                  if (popupContent) {
                    makePopupDraggable(popupContent, popup);
                  }
                }
              }, 100);

              // Set up close handler and store popup reference
              popup.on("close", () => {
                setActivePopup(null);
                setActiveCard(null);
                setShowLocationDetails(false);
              });

              // Update states
              setActivePopup(popup);
              setActiveCard(uniqueId);
              setShowLocationDetails(true);
            }
          });

          marker.getElement().setAttribute("data-location-id", uniqueId);
        }
      });

      // Fit map to show all markers
      if (geocodedLocations.length > 0) {
        mapInstance.current.fitBounds(bounds, { padding: 50 });
      }

      setSearchResults(geocodedLocations);
      setSearchStatus(
        `Found ${geocodedLocations.length} ${
          geocodedLocations.length === 1 ? "location" : "locations"
        }`
      );
    },
    [allLocations, premiumFilter, countryFilter, regionFilter, mapInstance]
  );

  // Effect to filter locations when filters change
  useEffect(() => {
    if (allLocations.length > 0 && mapInitialized) {
      filterAndDisplayLocations();
    }
  }, [
    premiumFilter,
    countryFilter,
    regionFilter,
    allLocations,
    mapInitialized,
    filterAndDisplayLocations,
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
        setLocationError("No locations found. Please try again.");
        return;
      }

      let searchCoords;
      let centerLocation;

      if (typeof addressOrCoords === "string") {
        const trimmedAddress = addressOrCoords.trim().toLowerCase();
        if (!trimmedAddress) return;

        try {
          // First try to find a direct match in our Airtable locations
          const directMatch = geocodedLocations.find((loc) => {
            // Safely get and convert fields to lowercase strings
            const locationName =
              typeof loc.fields[ADDRESS_FIELD_ID] === "string"
                ? loc.fields[ADDRESS_FIELD_ID].toLowerCase()
                : "";

            const address =
              typeof loc.fields[ADDRESS_FIELD_ID] === "string"
                ? loc.fields[ADDRESS_FIELD_ID].toLowerCase()
                : "";

            const geoAddress =
              typeof loc.fields[ADDRESS_FIELD_ID] === "string"
                ? loc.fields[ADDRESS_FIELD_ID].toLowerCase()
                : "";

            const searchTerm = trimmedAddress || "";

            return (
              locationName.includes(searchTerm) ||
              address.includes(searchTerm) ||
              geoAddress.includes(searchTerm)
            );
          });

          if (directMatch && directMatch.coordinates) {
            // We found a matching location in our database
            searchCoords = directMatch.coordinates;
            centerLocation = directMatch;
          } else {
            // If no direct match, use Mapbox geocoding
            const response = await mapboxClient
              .forwardGeocode({
                query: trimmedAddress,
                limit: 1,
                types: ["place", "address", "poi", "region", "country"],
                language: ["en"],
                countries: [
                  "US",
                  "CA",
                  "MX",
                  "BR",
                  "CO",
                  "AR",
                  "CL",
                  "PE",
                  "EC",
                  "VE",
                  "UY",
                  "PY",
                  "BO",
                  "CR",
                  "PA",
                  "DO",
                  "PR",
                  "GT",
                  "SV",
                  "HN",
                  "NI",
                ],
                autocomplete: true,
                fuzzyMatch: true,
              })
              .send();

            if (response.body.features.length) {
              searchCoords = response.body.features[0].center;

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
        } catch (error) {
          console.error("Error in search:", error);
        }
      } else if (Array.isArray(addressOrCoords)) {
        searchCoords = addressOrCoords;
      }

      if (!searchCoords) {
        setLoading(false);
        setLocationError(
          "Unable to find that location. Please try a different search term."
        );
        return;
      }

      // Process results - show all locations within radius of the found location
      const bounds = new mapboxgl.LngLatBounds();
      const results = geocodedLocations
        .filter((location) => {
          if (!location?.coordinates) return false;
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

          marker.getElement().addEventListener("click", (e) => {
            e.stopPropagation();
            handleLocationSelect({
              ...location.fields,
              coordinates: location.coordinates,
              id: uniqueId,
              index,
              uniqueId,
            });
          });

          return {
            ...location.fields,
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
        setLocationError(
          "No locations found within the selected radius. Try increasing the search radius."
        );
      }

      if (window.innerWidth <= 768) {
        setIsSearchCollapsed(true);
      }
    } catch (error) {
      console.error("Error in search:", error);
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
      if (!location || !location.coordinates) {
        console.log("Invalid location data:", location);
        return;
      }

      // Prevent event bubbling
      event?.stopPropagation();

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
          openPopup(null, location.coordinates, location.uniqueId, location);
        }, 300);
      }
    },
    [mapInstance, openPopup, closeAllPopups]
  );

  // Update the result item click handler
  const handleResultItemClick = useCallback(
    (location) => {
      handleLocationSelect(location);

      // On mobile, collapse the results panel
      if (window.innerWidth <= 768) {
        setIsResultsVisible(false);
      }
    },
    [handleLocationSelect]
  );

  // Initialize map
  useEffect(() => {
    console.log("Map initialization starting...");
    console.log("Container ref:", mapContainer.current);
    console.log("Mapbox token:", MAPBOX_TOKEN?.substring(0, 8) + "...");

    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }

    if (mapInstance.current) {
      console.log("Map already initialized");
      return;
    }

    if (!MAPBOX_TOKEN) {
      setMapError("Mapbox token is missing");
      return;
    }

    try {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: DEFAULT_CENTER,
        zoom: 10,
        minZoom: 2,
      });

      map.on("load", () => {
        console.log("Map loaded successfully");
        setMapInitialized(true);
        setIsMapLoading(false);
      });

      map.on("error", (e) => {
        console.error("Map error:", e);
        setMapError(e.error?.message || "An error occurred loading the map");
      });

      mapInstance.current = map;
      setMap(map);
    } catch (error) {
      console.error("Error creating map:", error);
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
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      e.preventDefault();
      runSearch();
    }
  };

  const handleSearch = async () => {
    setSearchStatus("Searching...");
    try {
      await runSearch(searchQuery, searchRadius, premiumFilter);
      const resultCount = searchResults.length;
      setSearchStatus(
        `Found ${resultCount} ${resultCount === 1 ? "location" : "locations"}`
      );
    } catch (error) {
      setSearchStatus("Search failed. Please try again.");
      console.error("Search error:", error);
    }
  };

  const showAllLocations = async () => {
    if (!mapInstance.current || !mapInitialized) {
      console.error("Map not initialized");
      setSearchStatus("Please wait for the map to initialize...");
      return;
    }

    setSearchStatus("Loading all locations...");
    try {
      // Fetch all locations and let the filter system handle display
      await fetchLocations(true);

      // Get the filtered locations that are currently displayed on the map
      const filteredLocations = allLocations.filter((loc) => {
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
      setSearchStatus(`Showing ${sortedLocations.length} locations`);
    } catch (error) {
      console.error("Error showing all locations:", error);
      setSearchStatus("Failed to load locations. Please try again.");
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

  return (
    <div className={styles.container}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      <div className={styles.searchContainer}>
        <div className={styles.searchControls}>
          <div className={styles.headerSection}>
            <div className={styles.mapLogo}>
              <Image
                src="/gb-logo.png"
                alt="Gracie Barra Logo"
                width={150}
                height={40}
                priority={true}
                style={{ width: "auto", height: "40px" }}
              />
            </div>
            <h1 className={styles.mainTitle}>Global Map</h1>
          </div>

          <div className={styles.searchSection}>
            <div className={styles.searchInputGroup}>
              <input
                id="location-search"
                type="text"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by city, state, or zip code"
                aria-describedby="search-status"
              />
              <div className={styles.searchButtonGroup}>
                <button
                  onClick={handleSearch}
                  className={`${styles.searchButton} ${styles.iconButton}`}
                  disabled={isSearching || !searchQuery.trim()}
                  aria-label={isSearching ? "Searching..." : "Search"}
                  title="Search"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
                <button
                  onClick={getUserLocation}
                  className={`${styles.locationButton} ${styles.iconButton}`}
                  title="Find my location"
                  aria-label="Find my location"
                  disabled={loading}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="currentColor"
                  >
                    <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                  </svg>
                </button>
                <button
                  onClick={showAllLocations}
                  className={`${styles.allLocationsButton} ${styles.iconButton}`}
                  disabled={isSearching}
                  aria-label="Show all locations"
                  title="Show all locations"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className={styles.filterGroup}>
              <div className={styles.filterControls}>
                <div className={styles.filterItem}>
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    className={styles.filterIcon}
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <select
                    value={searchRadius}
                    onChange={(e) => setSearchRadius(e.target.value)}
                    className={styles.searchSelect}
                    aria-label="Search radius"
                  >
                    {radiusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterItem}>
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    className={styles.filterIcon}
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <select
                    value={premiumFilter}
                    onChange={(e) => setPremiumFilter(e.target.value)}
                    className={styles.searchSelect}
                    aria-label="Location type filter"
                  >
                    {premiumOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Country Filter */}
                <div className={styles.filterItem}>
                  <svg
                    className={styles.filterIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className={styles.searchSelect}
                    aria-label="Country filter"
                  >
                    {countryOptions(uniqueCountries).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Region Filter - Hidden */}
                <div className={styles.filterItem} style={{ display: "none" }}>
                  <svg
                    className={styles.filterIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <select
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className={styles.searchSelect}
                    aria-label="Region filter"
                    disabled
                  >
                    {regionOptions(uniqueRegions).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {searchResults.length > 0 && (
                  <div className={styles.filterItem}>
                    <button
                      onClick={() => setIsResultsVisible(!isResultsVisible)}
                      className={`${styles.toggleResultsButton} ${styles.iconButton}`}
                      aria-label={
                        isResultsVisible ? "Hide results" : "Show results"
                      }
                      title={`${isResultsVisible ? "Hide" : "Show"} results (${
                        searchResults.length
                      })`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                      >
                        {isResultsVisible ? (
                          <path d="M19 9l-7 7-7-7" />
                        ) : (
                          <path d="M5 15l7-7 7 7" />
                        )}
                      </svg>
                      <span className={styles.resultCount}>
                        {searchResults.length}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              id="search-status"
              className={styles.srOnly}
              role="status"
              aria-live="polite"
            >
              {searchStatus}
            </div>

            {locationError && (
              <div className={styles.errorMessage} role="alert">
                <svg className={styles.errorIcon} viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <div className={styles.errorContent}>
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
              </div>
            )}
          </div>
        </div>
      </div>

      <main className={styles.mainContent}>
        <div className={styles.mapSection}>
          <div className={styles.mapWrapper}>
            <div
              ref={mapContainer}
              className={styles.mapContainer}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
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
                  <button onClick={() => window.location.reload()}>
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Results Panel */}
        {searchResults.length > 0 && (
          <div
            className={`${styles.resultsList} ${
              isResultsVisible ? styles.visible : ""
            }`}
          >
            <div className={styles.resultsHeader}>
              <h3>Search Results ({searchResults.length})</h3>
              <button
                className={styles.closeResults}
                onClick={handleCloseResults}
                aria-label="Close results"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.resultsContent}>
              {searchResults.map((result) => (
                <div
                  key={result.uniqueId}
                  className={`${styles.resultItem} ${
                    activeCard === result.uniqueId ? styles.active : ""
                  }`}
                  onClick={() => handleResultItemClick(result)}
                  onKeyDown={(e) => handleKeyDown(e, result)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${
                    result.fields[SCHOOL_FIELD_ID] ||
                    result.fields[ADDRESS_FIELD_ID]
                  } - ${
                    result.distance
                      ? `${result.distance.toFixed(1)} miles away`
                      : ""
                  }`}
                >
                  <div className={styles.resultHeader}>
                    <h4>
                      {(() => {
                        // Try multiple possible school name fields
                        const schoolName =
                          result.fields[SCHOOL_FIELD_ID] ||
                          result.fields["School Name"] ||
                          result.fields["Name"] ||
                          result.fields["Title"] ||
                          result.fields["Location Name"];
                        return schoolName || result.fields[ADDRESS_FIELD_ID];
                      })()}
                    </h4>
                    <span className={styles.distance}>
                      {result.distance
                        ? `${result.distance.toFixed(1)} miles`
                        : ""}
                    </span>
                  </div>
                  <p>{result.fields[ADDRESS_FIELD_ID]}</p>
                  {result.fields[IS_PREMIUM_FIELD_ID] && (
                    <span className={styles.premiumBadge}>
                      Premium Location
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Large modal removed - using small popup system instead */}

      <Modal
        isOpen={instructorModalIsOpen}
        onRequestClose={closeInstructorModal}
        contentLabel="Instructor Details"
      >
        {instructorData && (
          <div className={styles.instructorDetails}>
            <h2>{instructorData[HEAD_INSTRUCTOR_FIELD_ID]}</h2>
            {instructorData["Photo (from Instructors)"] &&
              instructorData["Photo (from Instructors)"].map((photo, index) => (
                <Image
                  key={index}
                  src={photo.url}
                  alt={instructorData[HEAD_INSTRUCTOR_FIELD_ID]}
                  width={200}
                  height={200}
                  style={{ marginBottom: 10 }}
                />
              ))}
            <p>{instructorData["Instructor Description"]}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Component;
