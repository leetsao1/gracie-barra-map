/**
 * Service for handling geolocation functionality
 */

/**
 * Get user's current location using browser geolocation
 * @returns {Promise<{latitude: number, longitude: number}>} User's coordinates
 */
export const getUserLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    const tryGeolocation = (highAccuracy = true) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          if (highAccuracy) {
            // Try again with lower accuracy
            tryGeolocation(false);
          } else {
            reject(error);
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 5000 : 10000,
          maximumAge: highAccuracy ? 30000 : 60000,
        }
      );
    };

    tryGeolocation();
  });
};

/**
 * Get approximate location based on IP address
 * @returns {Promise<{latitude: number, longitude: number}>} Approximate coordinates
 */
export const getIPLocation = async () => {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) {
      throw new Error("Failed to fetch IP location");
    }

    const data = await response.json();
    if (!data.latitude || !data.longitude) {
      throw new Error("Invalid IP location data");
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
    };
  } catch (error) {
    console.error("Error getting IP location:", error);
    throw error;
  }
};

/**
 * Get user's location with fallback to IP-based location
 * @returns {Promise<{latitude: number, longitude: number}>} User's coordinates
 */
export const getLocationWithFallback = async () => {
  try {
    // Try browser geolocation first
    return await getUserLocation();
  } catch (error) {
    console.log("Browser geolocation failed, trying IP-based location:", error);

    try {
      // Fall back to IP-based location
      return await getIPLocation();
    } catch (ipError) {
      console.error("IP-based location failed:", ipError);
      throw new Error("Unable to determine your location");
    }
  }
};
