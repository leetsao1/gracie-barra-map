import React, { useEffect } from "react";
import mapboxgl from 'mapbox-gl';
import axios from 'axios'; // For making HTTP requests
import styles from "../styles/style.module.css";

// Airtable setup
const AIRTABLE_BASE_ID = 'apprkakhR1gSO8JIj';
const AIRTABLE_API_KEY = 'pat4znoV3DLMvj93j.387c4f8141eecf1aab474da2f6f58a544cd09ec4e3fb1bd247c234edfefa64ec';
const AIRTABLE_TABLE_NAME = 'Locations';

// Mapbox geocoding URL
const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';

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
        }
      });
      return response.data.records;
    } catch (error) {
      console.error("Error fetching data from Airtable:", error);
      return [];
    }
  };

  // Function to geocode address using Mapbox and get coordinates
  const geocodeAddress = async (address) => {
    try {
      const response = await axios.get(`${MAPBOX_GEOCODING_URL}${encodeURIComponent(address)}.json`, {
        params: {
          access_token: mapboxgl.accessToken
        }
      });
      const [lng, lat] = response.data.features[0].center; // Extract longitude and latitude
      return { lng, lat };
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
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [0, 0], // Set initial center of the map
        zoom: 1 // Set initial zoom level
      });

      // Fetch locations from Airtable
      const locations = await fetchLocations();

      // Loop through locations and add them as markers to the map
      locations.forEach(async (location) => {
        const address = location.fields['Full Address'];
        const name = location.fields['Location Name'];

        // Geocode the address to get the coordinates
        const coords = await geocodeAddress(address);
        if (coords) {
          // Add marker to the map at the geocoded location
          new mapboxgl.Marker()
            .setLngLat([coords.lng, coords.lat])
            .setPopup(new mapboxgl.Popup().setText(name)) // Add popup with location name
            .addTo(map);
        }
      });

      return () => map.remove(); // Cleanup map on component unmount
    };

    initMap(); // Call the function to initialize the map
  }, []);

  return (
    <div ref={mapContainer} className={styles.mapContainer} />
  );
};

export default Component;

