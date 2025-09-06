/**
 * Service for interacting with Airtable API
 */
import { haversineDistance } from "../components/utils/distance.js";

const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.NEXT_PUBLIC_AIRTABLE_TABLE_ID;
const AIRTABLE_VIEW_ID = process.env.NEXT_PUBLIC_AIRTABLE_VIEW_ID;
const LATITUDE_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_LATITUDE_FIELD_ID;
const LONGITUDE_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_LONGITUDE_FIELD_ID;
const ADDRESS_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_ADDRESS_FIELD_ID;
const HEAD_INSTRUCTOR_FIELD_ID =
  process.env.NEXT_PUBLIC_AIRTABLE_HEAD_INSTRUCTOR_FIELD_ID;
const PHONE_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_PHONE_FIELD_ID;
const EMAIL_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_EMAIL_FIELD_ID;
const IS_PREMIUM_FIELD_ID =
  process.env.NEXT_PUBLIC_AIRTABLE_IS_PREMIUM_FIELD_ID;
const COUNTRY_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_COUNTRY_FIELD_ID;
const REGION_FIELD_ID = process.env.NEXT_PUBLIC_AIRTABLE_REGION_FIELD_ID;

/**
 * Fetch all locations from Airtable with pagination
 * @returns {Promise<Array>} Array of location records
 */
export const fetchLocations = async () => {
  let allRecords = [];
  let offset = null;

  // Define the fields we need for the map using field IDs
  // Only include fields that are defined in environment variables
  const fields = [];

  if (ADDRESS_FIELD_ID) fields.push(ADDRESS_FIELD_ID);
  if (HEAD_INSTRUCTOR_FIELD_ID) fields.push(HEAD_INSTRUCTOR_FIELD_ID);
  if (PHONE_FIELD_ID) fields.push(PHONE_FIELD_ID);
  if (EMAIL_FIELD_ID) fields.push(EMAIL_FIELD_ID);
  if (IS_PREMIUM_FIELD_ID) fields.push(IS_PREMIUM_FIELD_ID);
  if (COUNTRY_FIELD_ID) fields.push(COUNTRY_FIELD_ID);
  if (REGION_FIELD_ID) fields.push(REGION_FIELD_ID);
  if (LATITUDE_FIELD_ID) fields.push(LATITUDE_FIELD_ID);
  if (LONGITUDE_FIELD_ID) fields.push(LONGITUDE_FIELD_ID);

  const fieldsParam = fields
    .map((field) => `fields[]=${encodeURIComponent(field)}`)
    .join("&");

  try {
    do {
      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?view=${AIRTABLE_VIEW_ID}&returnFieldsByFieldId=true&${fieldsParam}${
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
      console.log("Airtable API response:", data);
      console.log("Records in this batch:", data.records.length);
      allRecords = [...allRecords, ...data.records];
      offset = data.offset;
    } while (offset);

    console.log("Total records fetched from Airtable:", allRecords.length);
    console.log("Sample record:", allRecords[0]);
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
        location.fields[LONGITUDE_FIELD_ID],
        location.fields[LATITUDE_FIELD_ID],
      ];
      const distance = haversineDistance(searchCoords, locationCoords);
      return radius === "any" || distance <= radius;
    });
  } catch (error) {
    console.error("Error filtering locations:", error);
    throw error;
  }
};
