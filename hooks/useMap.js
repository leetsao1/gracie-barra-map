import { useState, useCallback, useEffect } from "react";
import {
  animateMapMove,
  bounceMarker,
} from "../components/utils/mapAnimations";
import { createMarker, createPopup } from "../services/mapbox";
import { getLocationWithFallback } from "../services/geolocation";

/**
 * Custom hook for managing map state and functionality
 * @returns {Object} Map state and functions
 */
export const useMap = () => {
  const [map, setMap] = useState(null);
  const [userMarker, setUserMarker] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle map initialization
  const handleMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  // Handle location selection
  const handleLocationSelect = useCallback(
    async (location) => {
      if (!map || !location) return;

      setSelectedLocation(location);
      setLoading(true);

      try {
        await animateMapMove(map, {
          center: location.coordinates,
          zoom: 14,
          duration: 1000,
        });

        if (location.marker && location.popup) {
          location.popup.setLngLat(location.coordinates).addTo(map);
          bounceMarker(location.marker);
        }
      } catch (error) {
        console.error("Error selecting location:", error);
        setError("Error selecting location. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [map]
  );

  // Handle user location request
  const handleLocationRequest = useCallback(async () => {
    if (!map) return;

    setLoading(true);
    setError(null);

    try {
      const { latitude, longitude } = await getLocationWithFallback();
      const coordinates = [longitude, latitude];

      // Remove existing user marker
      if (userMarker) {
        userMarker.remove();
      }

      // Create new user marker
      const marker = createMarker({
        coordinates,
        color: "blue",
      });
      marker.addTo(map);
      setUserMarker(marker);

      // Animate map to user location
      await animateMapMove(map, {
        center: coordinates,
        zoom: 12,
        duration: 1000,
      });

      // Bounce the marker
      bounceMarker(marker);
    } catch (error) {
      console.error("Error getting location:", error);
      setError(
        "Unable to determine your location. Please try again or enter an address manually."
      );
    } finally {
      setLoading(false);
    }
  }, [map, userMarker]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (userMarker) {
        userMarker.remove();
      }
      if (map) {
        map.remove();
      }
    };
  }, [map, userMarker]);

  return {
    map,
    userMarker,
    searchResults,
    selectedLocation,
    loading,
    error,
    handleMapLoad,
    handleLocationSelect,
    handleLocationRequest,
    setSearchResults,
    setError,
  };
};
