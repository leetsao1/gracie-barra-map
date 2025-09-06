import { useState, useCallback } from "react";
import { fetchLocations, filterLocations } from "../services/airtable";
import { geocodeAddress } from "../services/mapbox";
import { createMarker, createPopup } from "../services/mapbox";

/**
 * Custom hook for managing search functionality
 * @param {Object} map - Mapbox map instance
 * @returns {Object} Search state and functions
 */
export const useSearch = (map) => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle search
  const handleSearch = useCallback(
    async ({ address, radius, filter }) => {
      if (!map) return;

      setLoading(true);
      setError(null);
      setSearchResults([]);

      try {
        // Fetch all locations
        const allLocations = await fetchLocations();

        // Filter locations based on search criteria
        const filteredLocations = await filterLocations(allLocations, {
          address,
          radius,
          filter,
        });

        // Create markers and popups for filtered locations
        const results = await Promise.all(
          filteredLocations.map(async (location) => {
            const coordinates = [
              location.fields.longitude,
              location.fields.latitude,
            ];

            // Create marker
            const marker = createMarker({
              coordinates,
              color: location.fields.isPremium ? "gold" : "red",
            });

            // Create popup content
            const popupContent = `
            <div class="location-popup">
              <h3>${location.fields["Location Name"]}</h3>
              <p>${location.fields["Full Address"]}</p>
              ${
                location.fields.isPremium
                  ? '<div class="premium-badge">Premium</div>'
                  : ""
              }
            </div>
          `;

            // Create popup
            const popup = createPopup({
              content: popupContent,
            });

            return {
              ...location.fields,
              coordinates,
              marker,
              popup,
            };
          })
        );

        // Add markers to map
        results.forEach((result) => {
          result.marker.addTo(map);
        });

        setSearchResults(results);

        // Fit map bounds to show all results
        if (results.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          results.forEach((result) => {
            bounds.extend(result.coordinates);
          });
          map.fitBounds(bounds, { padding: 50 });
        }
      } catch (error) {
        setError("Error performing search. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [map]
  );

  return {
    searchResults,
    loading,
    error,
    handleSearch,
    setError,
  };
};
