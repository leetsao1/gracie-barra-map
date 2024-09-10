import React, { useEffect, useState } from "react";
import mapboxgl from 'mapbox-gl';
import mapboxSdk from '@mapbox/mapbox-sdk/services/geocoding';
import Modal from 'react-modal';
import styles from "../styles/style.module.css";
import 'mapbox-gl/dist/mapbox-gl.css';

// Airtable setup
const AIRTABLE_BASE_ID = 'apprkakhR1gSO8JIj';
const AIRTABLE_API_KEY = 'pat4znoV3DLMvj93j.387c4f8141eecf1aab474da2f6f58a544cd09ec4e3fb1bd247c234edfefa64ec';
const AIRTABLE_TABLE_NAME = 'Locations';
const AIRTABLE_VIEW_NAME = 'US'; // Specify the view

// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZW5yaXF1ZXRjaGF0IiwiYSI6ImNrczVvdnJ5eTFlNWEycHJ3ZXlqZjFhaXUifQ.71mYPeoLXSujYlj4X5bQnQ';


// Initialize the Mapbox geocoding client
const mapboxClient = mapboxSdk({ accessToken: mapboxgl.accessToken });

const Component = () => {
  const mapContainer = React.useRef(null);
  const [error, setError] = useState(null);

  // Function to fetch locations from Airtable with pagination handling
  const fetchLocations = async () => {
    const allRecords = [];
    let offset = '';

    do {
      try {
        const response = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?view=${AIRTABLE_VIEW_NAME}&offset=${offset}`,
          {
            headers: {
              Authorization: `Bearer ${AIRTABLE_API_KEY}`
            }
          }
        );
        const data = await response.json();
        allRecords.push(...data.records);
        offset = data.offset || '';
      } catch (err) {
        console.error('Error fetching data from Airtable:', err);
        setError('Error fetching data from Airtable');
      }
    } while (offset);

    return allRecords;
  };

  // Initialize the map and fetch locations on component mount
  useEffect(() => {
    const initMap = async () => {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-98.5795, 39.8283], // Set initial center to US
        zoom: 4 // Set zoom level for better visibility
      });

      // Fetch locations from Airtable
      const locations = await fetchLocations();
      const bounds = new mapboxgl.LngLatBounds();
      let hasValidCoords = false; // Track if at least one valid marker exists

      // Loop through locations and geocode them
      for (const location of locations) {
        const address = location.fields['Full Address'];
        const name = location.fields['Location Name'];

        try {
          const response = await mapboxClient
            .forwardGeocode({
              query: address,
              autocomplete: false,
              limit: 1
            })
            .send();

          if (
            !response ||
            !response.body ||
            !response.body.features ||
            !response.body.features.length
          ) {
            console.warn(`Could not geocode address: ${address}`);
            continue;
          }

          const feature = response.body.features[0];
          const coords = feature.center;

          if (!coords || coords.length !== 2) {
            console.warn(`Invalid coordinates for address: ${address}`);
            continue;
          }

          console.log(`Geocoded ${address}:`, coords);

          // Add marker to the map
          new mapboxgl.Marker()
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup().setText(name)) // Add popup with location name
            .addTo(map);

          // Extend map bounds to include this marker
          bounds.extend(coords);
          hasValidCoords = true;

        } catch (error) {
          console.error(`Error geocoding address: ${address}`, error);
        }
      }

      // Adjust the map to fit all markers
      if (hasValidCoords) {
        map.fitBounds(bounds, { padding: 50 });
      } else {
        console.warn("No valid coordinates found for any address.");
      }
    };

    initMap(); // Call the function to initialize the map
  }, []);

  return (
    <>
      {error && <div className="error">{error}</div>}
      <div ref={mapContainer} className={styles.mapContainer} />
    </>
  );
};

export default Component;
