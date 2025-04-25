/**
 * Service for interacting with Airtable API
 */

const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY;
const AIRTABLE_TABLE_NAME = "Locations";
const AIRTABLE_VIEW_NAME = "US";

/**
 * Fetch all locations from Airtable with pagination
 * @returns {Promise<Array>} Array of location records
 */
export const fetchLocations = async () => {
  let allRecords = [];
  let offset = null;

  try {
    do {
      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?view=${AIRTABLE_VIEW_NAME}${
          offset ? `&offset=${offset}` : ""
        }`,
        {
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Airtable API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      allRecords = [...allRecords, ...data.records];
      offset = data.offset;
    } while (offset);

    return allRecords;
  } catch (error) {
    console.error("Error fetching data from Airtable:", error);
    throw error;
  }
};

/**
 * Filter locations based on search criteria
 * @param {Array} locations - Array of location records
 * @param {Object} criteria - Search criteria
 * @param {string} criteria.address - Search address
 * @param {number|string} criteria.radius - Search radius in miles
 * @param {string} criteria.filter - Filter type ('all' or 'premium')
 * @returns {Promise<Array>} Filtered locations
 */
export const filterLocations = async (locations, criteria) => {
  const { address, radius, filter } = criteria;

  try {
    // Filter by premium status first
    let filteredLocations = locations;
    if (filter === "premium") {
      filteredLocations = locations.filter(
        (location) => location.fields.isPremium
      );
    }

    // If no address provided, return all filtered locations
    if (!address) {
      return filteredLocations;
    }

    // Geocode the search address
    const geocodeResponse = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        address
      )}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    );

    if (!geocodeResponse.ok) {
      throw new Error("Error geocoding address");
    }

    const geocodeData = await geocodeResponse.json();
    if (!geocodeData.features.length) {
      throw new Error("No results found for the provided address");
    }

    const searchCoords = geocodeData.features[0].center;

    // Filter by distance
    return filteredLocations.filter((location) => {
      const locationCoords = [
        location.fields.longitude,
        location.fields.latitude,
      ];
      const distance = haversineDistance(searchCoords, locationCoords);
      return radius === "any" || distance <= radius;
    });
  } catch (error) {
    console.error("Error filtering locations:", error);
    throw error;
  }
};
