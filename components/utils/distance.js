/**
 * Calculate the distance between two points on Earth using the Haversine formula
 * @param {[number, number]} coords1 - [longitude, latitude] of first point
 * @param {[number, number]} coords2 - [longitude, latitude] of second point
 * @returns {number} Distance in miles
 */
export const haversineDistance = (coords1, coords2) => {
  if (
    !Array.isArray(coords1) ||
    !Array.isArray(coords2) ||
    coords1.length !== 2 ||
    coords2.length !== 2
  ) {
    throw new Error("Invalid coordinates provided");
  }

  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceInMeters = R * c;
  return distanceInMeters / 1609.34; // Convert meters to miles
};

/**
 * Format distance for display
 * @param {number} distance - Distance in miles
 * @returns {string} Formatted distance string
 */
export const formatDistance = (distance) => {
  if (typeof distance !== "number" || isNaN(distance)) {
    return "Unknown distance";
  }
  return `${Math.round(distance * 10) / 10} miles`;
};
