/**
 * Service for handling Mapbox functionality
 */

import mapboxgl from "mapbox-gl";
import mapboxSdk from "@mapbox/mapbox-sdk/services/geocoding";

// Initialize Mapbox client
const mapboxClient = mapboxSdk({
  accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
});

/**
 * Geocode an address to coordinates
 * @param {string} address - Address to geocode
 * @returns {Promise<[number, number]>} Coordinates [longitude, latitude]
 */
export const geocodeAddress = async (address) => {
  try {
    const response = await mapboxClient
      .forwardGeocode({
        query: address,
        limit: 1,
        types: ["address", "place", "poi"],
      })
      .send();

    if (!response.body.features.length) {
      throw new Error("No results found for the provided address");
    }

    return response.body.features[0].center;
  } catch (error) {
    console.error("Error geocoding address:", error);
    throw error;
  }
};

/**
 * Reverse geocode coordinates to an address
 * @param {[number, number]} coords - Coordinates [longitude, latitude]
 * @returns {Promise<string>} Formatted address
 */
export const reverseGeocode = async (coords) => {
  try {
    if (!Array.isArray(coords) || coords.length !== 2) {
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
    return `${coords[1]}, ${coords[0]}`; // Fallback to coordinates
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return `${coords[1]}, ${coords[0]}`; // Fallback to coordinates
  }
};

/**
 * Create a Mapbox marker
 * @param {Object} options - Marker options
 * @param {[number, number]} options.coordinates - Marker coordinates
 * @param {string} [options.color='red'] - Marker color
 * @param {HTMLElement} [options.element] - Custom marker element
 * @param {Function} [options.onClick] - Click handler
 * @returns {mapboxgl.Marker} Mapbox marker instance
 */
export const createMarker = ({
  coordinates,
  color = "red",
  element,
  onClick,
}) => {
  const marker = new mapboxgl.Marker({
    color,
    element,
    anchor: "center",
  }).setLngLat(coordinates);

  if (onClick) {
    marker.getElement().addEventListener("click", onClick);
  }

  return marker;
};

/**
 * Create a Mapbox popup
 * @param {Object} options - Popup options
 * @param {string} options.content - Popup content HTML
 * @param {boolean} [options.closeButton=true] - Show close button
 * @param {number} [options.maxWidth='350px'] - Maximum width
 * @returns {mapboxgl.Popup} Mapbox popup instance
 */
export const createPopup = ({
  content,
  closeButton = true,
  maxWidth = "350px",
}) => {
  return new mapboxgl.Popup({
    closeButton,
    maxWidth,
    closeOnClick: false,
    offset: [0, -10],
  }).setHTML(content);
};
