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

const radiusOptions = [
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
  { value: 100, label: '100 miles' },
  { value: 'any', label: 'Any distance' },
];

// Haversine formula to calculate distance between two latitude/longitude points
function haversineDistance(coords1, coords2) {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceInMeters = R * c; // in meters
  return distanceInMeters / 1609.34; // Convert meters to miles
}

const Component = () => {
  const mapContainer = React.useRef(null);
  const [map, setMap] = useState(null); // Store the map instance
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [searchRadius, setSearchRadius] = useState(50);

  // Function to fetch locations from Airtable with pagination
  const fetchLocations = async () => {
    let allRecords = [];
    let offset = null;

    try {
      do {
        const response = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?view=${AIRTABLE_VIEW_NAME}${offset ? `&offset=${offset}` : ''}`, {
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`
          }
        });

        const data = await response.json();
        allRecords = [...allRecords, ...data.records];
        offset = data.offset;

      } while (offset);

      console.log('Fetched locations from Airtable:', allRecords);
      return allRecords;

    } catch (error) {
      console.error("Error fetching data from Airtable:", error);
      return [];
    }
  };

  const openModal = (data) => {
    setModalData(data);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setModalData(null);
  };

  // Convert coordinates to an address using Mapbox reverse geocoding
  const reverseGeocode = async (coords) => {
    try {
      const response = await mapboxClient.reverseGeocode({
        query: coords,
        limit: 1
      }).send();

      if (response.body.features.length) {
        return response.body.features[0].place_name;
      }
      return `${coords[1]}, ${coords[0]}`; // Fallback to coords if no address is found
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      return `${coords[1]}, ${coords[0]}`; // Fallback in case of error
    }
  };

  // Get user's current location, reverse geocode it, and trigger search
  const getUserLocationAndSearch = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const userCoords = [longitude, latitude];

        const address = await reverseGeocode(userCoords);
        setSearchAddress(address);

        initializeMap(userCoords); // Initialize map centered at user's location
        console.log("map initialized for address: "+address);
        //runSearch(address, 50); // Trigger search automatically after setting address
      });
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  };

  // Initialize map with a center at user's location or search address
  const initializeMap = (coords) => {
    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: coords, // Center on user's location
      zoom: 10 // Zoom level for better visibility
    });
    setMap(newMap); // Store map instance in state
  };

  const runSearch = async (addressOrCoords, radius) => {
    console.log("running search...");
    if (!map) return; // Ensure map is initialized

    const allLocations = await fetchLocations();
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidCoords = false;

    // Geocode the search address if it's not already coordinates
    let searchCoords;
    if (typeof addressOrCoords === 'string') {
      const searchResponse = await mapboxClient.forwardGeocode({ query: addressOrCoords, limit: 1 }).send();
      if (!searchResponse.body.features.length) return;
      searchCoords = searchResponse.body.features[0].center;
    } else {
      searchCoords = addressOrCoords; // Use coords directly if provided
    }

    // Loop through locations and filter by radius
    for (const location of allLocations) {
      const locAddress = location.fields['Address for Geolocation'];
      const name = location.fields['Location Name'];
      const isPremium = location.fields['isPremium'];
      const pinColor = isPremium ? 'gold' : 'red';

      try {
        const locResponse = await mapboxClient
          .forwardGeocode({
            query: locAddress,
            autocomplete: false,
            limit: 1
          })
          .send();

        if (!locResponse.body.features.length) continue;
        const locCoords = locResponse.body.features[0].center;

        // Calculate distance between search location and current location using Haversine formula
        const distanceInMiles = haversineDistance(searchCoords, locCoords);

        // If the radius is "any" or the distance is within the selected radius, add the marker
        if (radius === 'any' || distanceInMiles <= radius) {
          const marker = new mapboxgl.Marker({ color: pinColor })
            .setLngLat(locCoords)
            .setPopup(new mapboxgl.Popup().setText(name))
            .addTo(map);

          marker.getElement().addEventListener('click', () => {
            openModal(location.fields);
          });

          bounds.extend(locCoords);
          hasValidCoords = true;
        }

      } catch (error) {
        console.error(`Error geocoding address: ${locAddress}`, error);
      }
    }

    // Adjust the map to fit all markers
    if (hasValidCoords) {
      map.fitBounds(bounds, { padding: 50 });
    }
  };

 useEffect(() => {
    if (map) {
      runSearch(searchAddress, searchRadius);
    }
  }, [map]);

  useEffect(() => {
    getUserLocationAndSearch(); // On component mount, get user's location and trigger search
  }, []);

  return (
    <div>
      <div className={styles.searchContainer}>
        <input
          type="text"
          value={searchAddress}
          onChange={(e) => setSearchAddress(e.target.value)}
          placeholder="Enter address"
        />
        <select
          value={searchRadius}
          onChange={(e) => setSearchRadius(e.target.value)}
        >
          {radiusOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button onClick={() => runSearch(searchAddress, searchRadius)}>Search</button>
      </div>

      <div ref={mapContainer} className={styles.mapContainer} />

      <Modal isOpen={modalIsOpen} onRequestClose={closeModal} contentLabel="Location Details">
        {modalData && (
          <div>
            <h2>{modalData['Location Name']}</h2>
            <p><strong>Full Address:</strong> {modalData['Full Address']}</p>
            <p><strong>Instructor:</strong> {modalData['Instructor']}</p>
            <p><strong>Phone Number:</strong> {modalData['Phone Number']}</p>
            <p><strong>Website:</strong> <a href={modalData['Website']} target="_blank" rel="noopener noreferrer">{modalData['Website']}</a></p>
            <button onClick={closeModal}>Close</button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Component;
