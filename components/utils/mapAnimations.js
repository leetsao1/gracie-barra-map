/**
 * Animate map movement to a new position
 * @param {mapboxgl.Map} map - Mapbox map instance
 * @param {Object} options - Animation options
 * @param {[number, number]} options.center - Target center coordinates
 * @param {number} options.zoom - Target zoom level
 * @param {number} [options.duration=2000] - Animation duration in ms
 * @param {number} [options.pitch=0] - Target pitch angle
 * @returns {Promise} Resolves when animation is complete
 */
export const animateMapMove = (
  map,
  { center, zoom, duration = 2000, pitch = 0 }
) => {
  return new Promise((resolve) => {
    if (!map || !map.flyTo) {
      resolve();
      return;
    }

    map.flyTo({
      center,
      zoom,
      duration,
      pitch,
      essential: true,
      curve: 1.42,
      speed: 1.2,
      easing: (t) => t * (2 - t), // Ease out quadratic
    });

    map.once("moveend", resolve);
  });
};

/**
 * Animate a marker with a bounce effect
 * @param {mapboxgl.Marker} marker - Mapbox marker instance
 */
export const bounceMarker = (marker) => {
  if (!marker || !marker.setOffset) {
    return;
  }

  let start;
  const duration = 1000;
  const bounce = (timestamp) => {
    if (!start) start = timestamp;
    const progress = (timestamp - start) / duration;

    if (progress < 1) {
      const currentOffset = Math.sin(progress * Math.PI * 2) * 10;
      marker.setOffset([0, currentOffset]);
      requestAnimationFrame(bounce);
    } else {
      marker.setOffset([0, 0]);
    }
  };

  requestAnimationFrame(bounce);
};

/**
 * Create a smooth transition between two points
 * @param {[number, number]} start - Starting coordinates
 * @param {[number, number]} end - Ending coordinates
 * @param {number} steps - Number of steps in the transition
 * @returns {Array} Array of intermediate coordinates
 */
export const createTransitionPath = (start, end, steps = 100) => {
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = start[1] + (end[1] - start[1]) * t;
    const lng = start[0] + (end[0] - start[0]) * t;
    path.push([lng, lat]);
  }
  return path;
};
