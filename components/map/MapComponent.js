import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "../../styles/style.module.css";

// Default center coordinates (Riverside, CA)
const DEFAULT_CENTER = [-117.3755, 33.9806];

const MapComponent = ({ onMapLoad, onLocationSelect }) => {
  const mapContainer = useRef(null);
  const [map, setMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const initMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: 4,
      minZoom: 2,
      dragRotate: false,
      touchZoomRotate: true,
      touchPitch: false,
    });

    // Add navigation controls
    const navControl = new mapboxgl.NavigationControl({
      showCompass: false,
    });
    initMap.addControl(navControl, "top-right");

    // Add passive touch event handling
    const container = mapContainer.current;
    const touchStartHandler = () => {};
    const touchMoveHandler = () => {};

    container.addEventListener("touchstart", touchStartHandler, {
      passive: true,
    });
    container.addEventListener("touchmove", touchMoveHandler, {
      passive: true,
    });

    // Handle map load
    initMap.on("load", () => {
      setMap(initMap);
      setLoading(false);
      onMapLoad(initMap);
    });

    // Handle errors
    initMap.on("error", (e) => {
      setError("Error loading map. Please try again.");
      console.error("Map error:", e);
    });

    // Cleanup function
    return () => {
      container.removeEventListener("touchstart", touchStartHandler);
      container.removeEventListener("touchmove", touchMoveHandler);
      initMap.remove();
    };
  }, [onMapLoad]);

  return (
    <div className={styles.mapContainer}>
      {loading && <div className={styles.loadingOverlay}>Loading map...</div>}
      {error && <div className={styles.errorOverlay}>{error}</div>}
      <div ref={mapContainer} className={styles.map} />
    </div>
  );
};

export default MapComponent;
