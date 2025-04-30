import React, { useEffect, useState, useCallback, useRef } from "react";
import mapboxgl from "mapbox-gl";
import mapboxSdk from "@mapbox/mapbox-sdk/services/geocoding";
import Modal from "react-modal";
import styles from "../styles/style.module.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Image from "next/image";

// Airtable setup
const AIRTABLE_BASE_ID = "apprkakhR1gSO8JIj";
const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY;
const AIRTABLE_TABLE_NAME = "Locations";
const AIRTABLE_VIEW_NAME = "Grid view"; // Changed from "US" to "Grid view" to show all locations

// Mapbox access token
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Set the access token for mapboxgl
if (!MAPBOX_TOKEN) {
  console.error(
    "Mapbox token is missing! Make sure NEXT_PUBLIC_MAPBOX_TOKEN is set in your environment variables."
  );
} else {
  console.log("Mapbox token found:", MAPBOX_TOKEN.substring(0, 8) + "...");
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

// Disable worker to avoid cross-origin issues
mapboxgl.workerClass = null;

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

const Component = () => {
  const mapContainer = React.useRef(null);
  const mapInstance = React.useRef(null);
  const userMarkerRef = React.useRef(null);
  const [map, setMap] = useState(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [instructorModalIsOpen, setInstructorModalIsOpen] = useState(false);
  const [instructorData, setInstructorData] = useState(null);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchRadius, setSearchRadius] = useState(50);
  const [premiumFilter, setPremiumFilter] = useState("all");
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

    const isPremium = location["isPremium"] || false;
    const locationName =
      location["Location Name"] || "Location Name Not Available";
    const fullAddress = location["Full Address"] || "Address Not Available";
    const instructor = location["Instructor"] || "Instructor Not Available";
    const phone = location["Phone Number"];
    const formattedPhone =
      typeof phone === "string" ? phone : "Phone Not Available";
    const phoneDigits =
      typeof phone === "string" ? phone.replace(/[^0-9]/g, "") : "";
    const website = location["Website"] || "#";
    const locationId = location.id || `${locationName}-${fullAddress}`;

    const premiumDescription =
      "Gracie Barra Premium Schools are academies that meet a higher standard of excellence within the Gracie Barra network. These schools go beyond the basic operational standards, reflecting the highest level of compliance with Gracie Barra's methodology, facilities, and service quality.";

    return `
      <div class="${styles.locationCard}" data-location-id="${locationId}">
        <div class="${styles.locationHeader}">
          <h3>${locationName}</h3>
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
          
          <div class="${styles.locationLinks}">
            ${
              website !== "#"
                ? `
              <a href="${website}" target="_blank" rel="noopener noreferrer">
                Visit Website
              </a>
            `
                : ""
            }
            ${
              phoneDigits
                ? `
              <a href="tel:${phoneDigits}" class="phone-link">
                Call Now
              </a>
            `
                : ""
            }
            <a href="https://maps.google.com/?q=${encodeURIComponent(
              fullAddress
            )}" target="_blank" rel="noopener noreferrer">
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
    setModalData(null);
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
          closeButton: true,
          maxWidth: "350px",
          closeOnClick: false,
          offset: [0, -10],
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

        // Set up close handler
        newPopup.on("close", () => {
          setActivePopup(null);
          setActiveCard(null);
          setModalData(null);
          setShowLocationDetails(false);
        });

        // Update states
        setActivePopup(newPopup);
        setActiveCard(locationId);
        setModalData(locationData);
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
      if (loc.fields["fldA9pKfnRoHfIbWT"] && loc.fields["fldyFcMeVUwAkNlM5"]) {
        const lat = parseFloat(loc.fields["fldA9pKfnRoHfIbWT"]);
        const lng = parseFloat(loc.fields["fldyFcMeVUwAkNlM5"]);
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
        (loc) =>
          loc.fields["fldA9pKfnRoHfIbWT"] && loc.fields["fldyFcMeVUwAkNlM5"]
      )
      .map((loc) => ({
        ...loc,
        coordinates: [
          parseFloat(loc.fields["fldyFcMeVUwAkNlM5"]), // Longitude
          parseFloat(loc.fields["fldA9pKfnRoHfIbWT"]), // Latitude
        ],
      }));

    // Only geocode locations without coordinates
    const locationsToGeocode = validLocations.filter(
      (loc) =>
        !loc.fields["fldA9pKfnRoHfIbWT"] || !loc.fields["fldyFcMeVUwAkNlM5"]
    );

    // First check cache for locations that need geocoding
    const uncachedLocations = locationsToGeocode.filter(
      (loc) => !locationCache.has(loc.fields["Address for Geolocation"])
    );

    if (uncachedLocations.length === 0) {
      const geocodedLocations = locationsToGeocode.map((loc) => ({
        ...loc,
        coordinates: locationCache.get(loc.fields["Address for Geolocation"]),
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
            const address = location.fields["Address for Geolocation"].trim();

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

    // Define the fields we need for the map
    const fields = [
      "Location Name",
      "Address for Geolocation",
      "Full Address",
      "Phone Number",
      "Website",
      "Instructor",
      "isPremium",
      "fldA9pKfnRoHfIbWT", // Latitude field
      "fldyFcMeVUwAkNlM5", // Longitude field
    ];

    const fieldsParam = fields
      .map((field) => `fields[]=${encodeURIComponent(field)}`)
      .join("&");

    try {
      // First try to get from cache
      const cacheKey = `${AIRTABLE_BASE_ID}-${AIRTABLE_TABLE_NAME}-${AIRTABLE_VIEW_NAME}`;
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
        let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
          AIRTABLE_TABLE_NAME
        )}?view=${encodeURIComponent(AIRTABLE_VIEW_NAME)}&${fieldsParam}`;

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
          throw new Error(
            `Airtable API error: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        const validRecords = data.records.filter(
          (record) =>
            record.fields["Location Name"] &&
            record.fields["Address for Geolocation"] &&
            record.fields["Full Address"]
        );

        allRecords = [...allRecords, ...validRecords];
        offset = data.offset;
      } while (offset);

      // Cache the results with a shorter expiration
      localStorage.setItem(cacheKey, JSON.stringify(allRecords));
      localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());

      return allRecords;
    } catch (error) {
      console.error("Error fetching data from Airtable:", error);
      setLocationError("Unable to fetch locations. Please try again later.");
      return [];
    }
  };

  const showLocationPanel = (location, color) => {
    setModalData(location);
    setPinColor(color);
    setShowLocationDetails(true);
  };

  const hideLocationPanel = () => {
    setShowLocationDetails(false);
    setModalData(null);
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
          ? allLocations.filter((loc) => loc.fields["isPremium"])
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
              typeof loc.fields["Location Name"] === "string"
                ? loc.fields["Location Name"].toLowerCase()
                : "";

            const address =
              typeof loc.fields["Full Address"] === "string"
                ? loc.fields["Full Address"].toLowerCase()
                : "";

            const geoAddress =
              typeof loc.fields["Address for Geolocation"] === "string"
                ? loc.fields["Address for Geolocation"].toLowerCase()
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

          const isPremium = location.fields["isPremium"];
          const marker = new mapboxgl.Marker({
            color: isPremium ? "#FFD700" : "#FF0000",
            scale: isPremium ? 1.2 : 1,
          })
            .setLngLat(location.coordinates)
            .addTo(mapInstance.current);

          const uniqueId = `${location.id || ""}-${index}-${
            location.fields["Location Name"] || ""
          }-${location.fields["Full Address"] || ""}`.replace(
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

      // Smooth map transition
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

  // Initialize map on component mount
  useEffect(() => {
    let timeoutId;
    let loadingInterval;

    const initMap = async () => {
      console.log("Starting map initialization...");
      console.log(
        "Mapbox token status:",
        !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      );
      console.log("Map container status:", !!mapContainer.current);

      // Check for Mapbox token first
      if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
        console.error("Mapbox token is missing in environment variables");
        setMapError(
          "Mapbox token is missing. Please check your environment configuration."
        );
        setIsMapLoading(false);
        return;
      }

      // Set the token explicitly
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

      if (!mapInstance.current && mapContainer.current) {
        console.log("Creating new map instance...");
        setIsMapLoading(true);

        // Start loading progress simulation
        let progress = 0;
        loadingInterval = setInterval(() => {
          progress += 2;
          if (progress > 90) {
            clearInterval(loadingInterval);
          }
          setMapLoadingProgress(progress);
        }, 200);

        try {
          console.log("Initializing map with configuration...");
          // Create new map instance with minimal initial configuration
          mapInstance.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/streets-v12",
            center: DEFAULT_CENTER,
            zoom: 10,
            minZoom: 2,
            dragRotate: false,
            touchZoomRotate: true,
            touchPitch: false,
            preserveDrawingBuffer: true,
            attributionControl: false,
            logoPosition: "bottom-right",
          });

          console.log("Map instance created, waiting for load...");

          // Set a timeout for map loading with a longer duration (30 seconds)
          const mapLoadPromise = new Promise((resolve, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error("Map load timed out"));
            }, 30000); // 30 second timeout

            // Listen for both style.load and load events
            const handleLoad = () => {
              console.log("Map load event received!");
              clearTimeout(timeoutId);
              mapInstance.current.off("style.load", handleLoad);
              mapInstance.current.off("load", handleLoad);
              resolve();
            };

            mapInstance.current.on("style.load", handleLoad);
            mapInstance.current.on("load", handleLoad);
          });

          // Wait for map to load
          await mapLoadPromise;

          // Add controls after successful load
          mapInstance.current.addControl(
            new mapboxgl.NavigationControl({
              showCompass: false,
            }),
            "top-right"
          );

          mapInstance.current.addControl(
            new mapboxgl.AttributionControl({
              compact: true,
            })
          );

          console.log("Map successfully loaded and initialized!");
          setMap(mapInstance.current);
          setMapInitialized(true);
          setIsMapLoading(false);
          setMapLoadingProgress(100);

          // Force a resize to ensure proper rendering
          mapInstance.current.resize();
        } catch (error) {
          console.error("Error initializing map:", error);
          setMapError(
            "Unable to load the map. Please check your internet connection and refresh the page."
          );
          setIsMapLoading(false);
          if (loadingInterval) clearInterval(loadingInterval);
        }
      } else {
        console.log("Map instance or container not ready:", {
          instance: !!mapInstance.current,
          container: !!mapContainer.current,
        });
      }
    };

    initMap();

    // Cleanup function
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (loadingInterval) clearInterval(loadingInterval);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (mapInstance.current) {
        mapInstance.current.resize();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    setSearchResults([]);
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
    setSearchStatus("Loading all locations...");
    try {
      const allLocations = await fetchLocations(true);
      const geocodedLocations = await batchGeocodeLocations(allLocations);

      // Clear existing markers
      if (mapInstance.current) {
        const markers = document.getElementsByClassName("mapboxgl-marker");
        while (markers[0]) {
          markers[0].remove();
        }
      }

      // Process and show all locations
      const results = geocodedLocations
        .filter((location) => location?.coordinates)
        .map((location, index) => {
          const isPremium = location.fields["isPremium"];
          const marker = new mapboxgl.Marker({
            color: isPremium ? "#FFD700" : "#FF0000",
            scale: isPremium ? 1.2 : 1,
          })
            .setLngLat(location.coordinates)
            .addTo(mapInstance.current);

          const uniqueId = `${location.id || ""}-${index}-${
            location.fields["Location Name"] || ""
          }-${location.fields["Full Address"] || ""}`.replace(
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
            coordinates: location.coordinates,
            marker,
          };
        });

      setSearchResults(results);
      setSearchStatus(`Showing all ${results.length} locations`);
      setIsResultsVisible(true);

      // Fit map to show all locations
      if (results.length > 0 && mapInstance.current) {
        const bounds = new mapboxgl.LngLatBounds();
        results.forEach((location) => {
          bounds.extend(location.coordinates);
        });

        mapInstance.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 12,
        });
      }
    } catch (error) {
      console.error("Error showing all locations:", error);
      setSearchStatus("Failed to load all locations. Please try again.");
    }
  };

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
            <label htmlFor="location-search" className={styles.searchLabel}>
              Search for a location
            </label>
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
              <button
                onClick={getUserLocation}
                className={styles.locationButton}
                title="Find my location"
                aria-label="Find my location"
                disabled={loading}
              >
                <svg className={styles.locationIcon} viewBox="0 0 24 24">
                  <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                </svg>
              </button>
            </div>

            <div className={styles.filterGroup}>
              <button
                onClick={showAllLocations}
                className={`${styles.searchButton} ${styles.allLocationsButton}`}
                disabled={isSearching}
                aria-label="Show all locations"
              >
                All Locations
              </button>
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

              <button
                onClick={handleSearch}
                className={styles.searchButton}
                disabled={isSearching || !searchQuery.trim()}
                aria-label={isSearching ? "Searching..." : "Search"}
              >
                {isSearching ? (
                  <div
                    className={styles.spinner}
                    role="status"
                    aria-label="Loading"
                  />
                ) : (
                  "Search"
                )}
              </button>
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

      <main id="main-content" className={styles.mainContent}>
        <div
          ref={searchResultsRef}
          className={`${styles.resultsList} ${
            searchResults.length > 0 && isResultsVisible ? styles.visible : ""
          }`}
          role="region"
          aria-label="Search results"
          aria-expanded={searchResults.length > 0}
        >
          <div className={styles.resultsHeader}>
            <h2>Search Results</h2>
            <button
              onClick={handleCloseResults}
              className={styles.closeResults}
              aria-label="Close search results"
            >
              ×
            </button>
          </div>

          {Array.isArray(searchResults) &&
            searchResults.map((location) => {
              if (!location) return null;

              // Safely access location data
              const locationData = location.fields || location;
              const locationName =
                locationData["Location Name"] || "Unknown Location";
              const fullAddress =
                locationData["Full Address"] || "No address available";
              const isPremium = locationData["isPremium"] || false;
              const distance =
                typeof location.distance === "number"
                  ? `${location.distance.toFixed(1)} miles`
                  : "Unknown distance";

              return (
                <div
                  key={location.uniqueId || `${locationName}-${Date.now()}`}
                  className={`${styles.resultItem} ${
                    activeCard === location.uniqueId ? styles.active : ""
                  } ${styles.fadeIn}`}
                  style={{ animationDelay: `${location.index * 0.05}s` }}
                  onClick={() => handleLocationSelect(location)}
                  onKeyDown={(e) => handleKeyDown(e, location)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selectedLocation?.id === location.id}
                >
                  <div className={styles.resultHeader}>
                    <h4>{locationName}</h4>
                    <span className={styles.distance}>{distance}</span>
                  </div>
                  <p>{fullAddress}</p>
                  {isPremium && (
                    <span className={styles.premiumBadge}>
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        style={{ marginRight: "4px" }}
                      >
                        <path
                          fill="currentColor"
                          d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                        />
                      </svg>
                      Premium
                    </span>
                  )}
                </div>
              );
            })}
        </div>

        <div className={styles.mapSection}>
          <div className={styles.mapWrapper}>
            <div
              ref={mapContainer}
              className={styles.mapContainer}
              role="application"
              aria-label="Interactive map showing Gracie Barra locations"
            />

            {isMapLoading && (
              <div className={styles.mapOverlay}>
                <div className={styles.mapLoading}>
                  <div className={styles.loadingSpinner} />
                  <div className={styles.loadingProgress}>
                    <div
                      className={styles.loadingBar}
                      style={{ width: `${mapLoadingProgress}%` }}
                    />
                    <p>Loading map... {mapLoadingProgress}%</p>
                  </div>
                </div>
              </div>
            )}

            {mapError && !isMapLoading && (
              <div className={styles.mapOverlay}>
                <div className={styles.mapError}>
                  <p>{mapError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className={styles.retryButton}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Instructor Modal */}
      <Modal
        isOpen={instructorModalIsOpen}
        onRequestClose={closeInstructorModal}
        contentLabel="Instructor Details"
        style={customModalStyles(pinColor)}
        className={styles.fadeIn}
      >
        {instructorData && (
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Instructor Details</h2>
              <button
                onClick={closeInstructorModal}
                className={styles.closeButton}
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="currentColor"
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.instructorInfo}>
                <h3>{instructorData["Instructor"]}</h3>
                {instructorData["Certification Date (from Instructors)"] && (
                  <p className={styles.certificationDate}>
                    <strong>Certified:</strong>{" "}
                    {instructorData["Certification Date (from Instructors)"]}
                  </p>
                )}
                {instructorData["Bio (from Instructors)"] && (
                  <p className={styles.instructorBio}>
                    {instructorData["Bio (from Instructors)"]}
                  </p>
                )}
              </div>

              {instructorData["Photo (from Instructors)"] &&
                instructorData["Photo (from Instructors)"][0] && (
                  <div className={styles.instructorPhoto}>
                    <img
                      src={instructorData["Photo (from Instructors)"][0].url}
                      alt={instructorData["Instructor"]}
                      loading="lazy"
                    />
                  </div>
                )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Component;
