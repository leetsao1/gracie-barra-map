import React, { useEffect } from "react";
import mapboxgl from 'mapbox-gl';
import styles from "../styles/style.module.css";

const Component = () => {
  // The container where the Mapbox map will be rendered
  const mapContainer = React.useRef(null);
  // Initialize the map state once in the component
  useEffect(() => {
    mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN'; // Replace with your Mapbox access token
    
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11', // Mapbox style URL
      center: [0, 0], // initial geo location longitude and latitude
      zoom: 1 // initial zoom level
    });

    // Adding sample locations to the map as markers
    const locations = [
      { lng: -74.0060, lat: 40.7128 }, // New York
      { lng: -0.1276, lat: 51.5072 }  // London
    ];

    locations.forEach(location => {
      new mapboxgl.Marker()
        .setLngLat([location.lng, location.lat])
        .addTo(map);
    });

    return () => map.remove(); // Cleanup on component unmount
  }, []);

  return (
    <div ref={mapContainer} className={styles.mapContainer} />
  );
};

export default Component;
 