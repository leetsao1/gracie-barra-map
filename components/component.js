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

const mapboxClient = mapboxSdk({ accessToken: mapboxgl.accessToken });


// Clean up and truncate long addresses
const cleanAddress = (address) => {
  const addressParts = address.split(',');
  return addressParts.slice(0, 3).join(', ');
};

const Component = () => {
  const mapContainer = React.useRef(null);
  const [map, setMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [radius, setRadius] = useState(50); // Default radius in miles
  const [locations, setLocations] = useState([]);

  // Function to fetch locations from Airtable with pagination handling
  const fetchLocations = async () => {
    const allRecords = [];
    let offset = '';

    do {
      const response = await fetch(
        `https://api.airtable.com/v0/YOUR_BASE_ID/Locations?view=YOUR_VIEW_NAME&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer YOUR_AIRTABLE_API_KEY`,
          },
        }
      );
      const data = await response.json();
      allRecords.push(...data.records);
      offset = data.offset || '';
    } while (offset);

    return allRecords;
  };

  // Reverse geocode to get address from coordinates
  const reverseGeocode = async (coords) => {
    try {
      const response = await mapboxClient
        .reverseGeocode({
          query: coords,
          limit: 1,
        })
        .send();

      if (response.body.features.length > 0) {
        const address = response.body.features[0].place_name;
        setSearchAddress(address); // Set the reverse-geocoded address
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  };

  // Search function to filter locations based on address and radius
  const runSearch = async (searchAddress, radius) => {
    const allLocations = await fetchLocations();
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidCoords = false;

    allLocations.forEach(async (location) => {
      const locAddress = location.fields['Full Address'];
      const name = location.fields['Location Name'];
      const isPremium = location.fields['isPremium'];

      try {
        const locResponse = await mapboxClient
          .forwardGeocode({
            query: cleanAddress(locAddress),
            autocomplete: false,
            limit: 1,
          })
          .send();

        if (!locResponse.body.features.length) {
          console.warn(`Could not geocode address: ${locAddress}`);
          return;
        }

        const feature = locResponse.body.features[0];
        const coords = feature.center;

        // Calculate the distance between the searched location and the current location
        const userCoords = mapboxgl.MercatorCoordinate.fromLngLat(userLocation);
        const locationCoords = mapboxgl.MercatorCoordinate.fromLngLat(coords);
        const distance = userCoords.distanceTo(locationCoords);

        // If within the radius, add to the map
        if (distance <= radius * 1609.34) {
          new mapboxgl.Marker({ color: isPremium ? 'gold' : 'red' })
            .setLngLat(coords)
            .setPopup(
              new mapboxgl.Popup().setHTML(`
                <strong>${name}</strong><br />
                Address: ${locAddress}<br />
                Phone: ${location.fields['Phone Number'] || 'N/A'}<br />
                Website: <a href="${location.fields['Website']}" target="_blank">${location.fields['Website'] || 'N/A'}</a><br />
                Instructor: ${location.fields['Instructor'] || 'N/A'}
              `)
            )
            .addTo(map);
          bounds.extend(coords);
          hasValidCoords = true;
        }
      } catch (error) {
        console.error(`Error geocoding address: ${locAddress}`, error);
      }
    });

    if (hasValidCoords) {
      map.fitBounds(bounds, { padding: 50 });
    }
  };

  // Initialize the map and fetch locations on component mount
  useEffect(() => {
    const initMap = async () => {
      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-98.5795, 39.8283], // Center to the US
        zoom: 4,
      });

      setMap(newMap);

      // Get user's location and set as default
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const userCoords = [longitude, latitude];
        setUserLocation(userCoords);

        // Reverse geocode to get the address of the user's location
        await reverseGeocode(userCoords);

        // Run initial search with default radius
        runSearch(`${latitude}, ${longitude}`, 50);
      });
    };

    initMap();
  }, []);

  return (
    <div>
      {/* Search form */}
      <div className={styles.searchForm}>
        <input
          type="text"
          value={searchAddress}
          onChange={(e) => setSearchAddress(e.target.value)}
          placeholder="Enter address"
        />
        <select value={radius} onChange={(e) => setRadius(e.target.value)}>
          <option value="10">10 miles</option>
          <option value="25">25 miles</option>
          <option value="50">50 miles</option>
          <option value="100">100 miles</option>
          <option value="999999">Any</option>
        </select>
        <button onClick={() => runSearch(searchAddress, radius)}>Search</button>
      </div>

      {/* Map container */}
      <div ref={mapContainer} className={styles.mapContainer} />
    </div>
  );
};

export default Component;
