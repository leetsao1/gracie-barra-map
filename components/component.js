import React, { useEffect } from "react";
import mapboxgl from 'mapbox-gl';
import axios from 'axios'; // For making HTTP requests
import styles from "../styles/style.module.css";

// Airtable setup
const AIRTABLE_BASE_ID = 'apprkakhR1gSO8JIj';
const AIRTABLE_API_KEY = 'pat4znoV3DLMvj93j.387c4f8141eecf1aab474da2f6f58a544cd09ec4e3fb1bd247c234edfefa64ec';
const AIRTABLE_TABLE_NAME = 'Locations';

// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZW5yaXF1ZXRjaGF0IiwiYSI6ImNrczVvdnJ5eTFlNWEycHJ3ZXlqZjFhaXUifQ.71mYPeoLXSujYlj4X5bQnQ';

const Component = () => {
  const mapContainer = React.useRef(null);

  // Function to fetch locations from Airtable
  const fetchLocations = async () => {
    try {
      const response = await axios.get(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`
        },
        params: {
          view: 'US' // Fetching from a specific view called 'US'
        }
      });
      console.log('Fetched locations from Airtable:', response.data.records);
      return response.data.records;
    } catch (error) {
      console.error("Error fetching data from Airtable:", error);
      return [];
    }
  };

  // Initialize the map and add markers on component mount
  useEffect(() => {
    const initMap = async () => {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-98.5795, 39.8283], // Set initial center to US
        zoom: 4 // Set zoom level for better visibility
      });

      // Fetch locations from Airtable
      const locations = await fetchLocations();
      const bounds = new mapboxgl.LngLatBounds();

      // Loop through locations and add them as markers to the map
      locations.forEach((location) => {
        const { 'Location Name': name, 'Latitude': lat, 'Longitude': lng } = location.fields;

        if (lat && lng) {
          console.log(`Adding marker for ${name} at ${lat}, ${lng}`);

          // Add marker to the map using the provided coordinates
          new mapboxgl.Marker()
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup().setText(name)) // Add popup with location name
            .addTo(map);

          // Extend map bounds to include this marker
          bounds.extend([lng, lat]);
        } else {
          console.warn(`No coordinates available for: ${name}`);
        }
      });

      // Adjust the map to fit all markers
      map.fitBounds(bounds, { padding: 50 });

      return () => map.remove(); // Cleanup map on component unmount
    };

    initMap(); // Call the function to initialize the map
  }, []);

  return (
    <div ref={mapContainer} className={styles.mapContainer} />
  );
};

export default Component;
