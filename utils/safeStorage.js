/**
 * Safe localStorage wrapper with fallback to memory cache
 * Handles quota exceeded, privacy mode, and disabled storage
 */

// Fallback memory cache when localStorage is unavailable
const memoryCache = new Map();

const safeStorage = {
  /**
   * Safely get item from localStorage
   * @param {string} key - Storage key
   * @returns {string|null} Value or null
   */
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`localStorage.getItem failed for key "${key}":`, error.name);
      // Fallback to memory cache
      return memoryCache.get(key) || null;
    }
  },

  /**
   * Safely set item in localStorage
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   * @returns {boolean} Success status
   */
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`localStorage.setItem failed for key "${key}":`, error.name);

      // Handle QuotaExceededError - clear old cache entries
      if (error.name === 'QuotaExceededError') {
        try {
          // Clear old timestamp-based cache entries
          const keys = Object.keys(localStorage);
          const timestampKeys = keys.filter(k => k.endsWith('-timestamp'));

          // Sort by timestamp and remove oldest entries
          const sorted = timestampKeys
            .map(k => ({
              key: k.replace('-timestamp', ''),
              timestamp: parseInt(localStorage.getItem(k) || '0', 10)
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

          // Remove oldest 25% of entries
          const toRemove = Math.ceil(sorted.length * 0.25);
          for (let i = 0; i < toRemove; i++) {
            localStorage.removeItem(sorted[i].key);
            localStorage.removeItem(`${sorted[i].key}-timestamp`);
          }

          // Try again after cleanup
          localStorage.setItem(key, value);
          return true;
        } catch (retryError) {
          // If still fails, use memory cache
          memoryCache.set(key, value);
          return false;
        }
      }

      // For other errors (SecurityError, etc.), use memory cache
      memoryCache.set(key, value);
      return false;
    }
  },

  /**
   * Safely remove item from localStorage
   * @param {string} key - Storage key
   */
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      memoryCache.delete(key); // Also remove from memory cache
    } catch (error) {
      console.warn(`localStorage.removeItem failed for key "${key}":`, error.name);
      memoryCache.delete(key);
    }
  },

  /**
   * Check if localStorage is available
   * @returns {boolean}
   */
  isAvailable: () => {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get current storage usage (if available)
   * @returns {number|null} Bytes used or null if unavailable
   */
  getUsage: () => {
    try {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
      return total;
    } catch {
      return null;
    }
  }
};

export default safeStorage;
