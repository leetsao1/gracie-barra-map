import React, { useEffect } from "react";
import mapboxgl from 'mapbox-gl';
import mapboxSdk from '@mapbox/mapbox-sdk'; // Import the Mapbox SDK for geocoding
import styles from "../styles/style.module.css";

// Airtable setup
const AIRTABLE_BASE_ID = 'apprkakhR1gSO8JIj';
const AIRTABLE_API_KEY = 'pat4znoV3DLMvj93j.387c4f8141eecf1aab474da2f6f58a544cd09ec4e3fb1bd247c234edfefa64ec';
const AIRTABLE_TABLE_NAME = 'Locations';

// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZW5yaXF1ZXRjaGF0IiwiYSI6ImNrczVvdnJ5eTFlNWEycHJ3ZXlqZjFhaXUifQ.71mYPeoLXSujYlj4X5bQnQ';

// Initialize the Mapbox client
const mapboxClient = mapboxSdk({ accessToken: mapboxgl.accessToken });

const Component = () => {
  const mapContainer = React.useRef(null);

  // Function to fetch locations from Airtable
  const fetchLocations = async () => {
    try {
      const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`
        }
      });
      const data = await response.json();
      console.log('Fetched locations from Airtable:', data.records);
      return data.records;
    } catch (error) {
      console.error("Error fetching data from Airtable:", error);
      return [];
    }
  };

  // Function to geocode address using Mapbox SDK and get coordinates
  const geocodeAddress = async (address) => {
    try {
      const response = await mapboxClient.geocoding
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
        console.error(`No geocoding result for: ${address}`);
        return null;
      }

      const feature = response.body.features[0];
      console.log(`Geocoded ${address}:`, feature.center);
      return feature.center; // Returns [lng, lat]
    } catch (error) {
      console.error("Error geocoding address:", error);
      return null;
    }
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

      // Loop through locations and add them as markers to the map
      for (const location of locations) {
        const address = location.fields['Full Address'];
        const name = location.fields['Location Name'];

        const coords = await geocodeAddress(address);
        if (coords) {
          // Add marker to the map at the geocoded location
          new mapboxgl.Marker()
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup().setText(name)) // Add popup with location name
            .addTo(map);
          
          // Extend map bounds to include this marker
          bounds.extend(coords);
          hasValidCoords = true; // Found at least one valid marker
        } else {
          console.warn(`Could not geocode address: ${address}`);
        }
      }

      // Adjust the map to fit all markers only if we have valid coordinates
      if (hasValidCoords) {
        map.fitBounds(bounds, { padding: 50 });
      }

      return () => map.remove(); // Cleanup map on component unmount
    };

    initMap(); // Call the function to initialize the map
  }, []);

  return (
    <div ref={mapContainer} className={styles.mapContainer} />
  );
};

export default Component;
