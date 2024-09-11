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
  const φ2 = lon2 * Math.PI / 180;
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
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [searchRadius, setSearchRadius] = useState(50);
  const [allLocations, setAllLocations] = useState([]);
  const [mapInstance, setMapInstance] = useState(null);

  // Fetch all Airtable locations once and store them in state
  const fetchLocationsOnce = async () => {
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

      setAllLocations(allRecords); // Store in state after fetching
      console.log('Fetched locations from Airtable:', allRecords);

    } catch (error) {
      console.error("Error fetching data from Airtable:", error);
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

  const getUserLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const userCoords = [longitude, latitude];
        setUserLocation(userCoords);

        const reverseGeocodeResponse = await mapboxClient.reverseGeocode({
          query: userCoords,
          limit: 1
        }).send();

        if (reverseGeocodeResponse.body.features.length) {
          const address = reverseGeocodeResponse.body.features[0].place_name;
          setSearchAddress(address);
          runSearch(userCoords, 50); // Run search automatically
        }
      });
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  };

  const runSearch = (searchCoords, radius) => {
    if (!mapInstance) return;

    const bounds = new mapboxgl.LngLatBounds();
    let hasValidCoords = false;

    for (const location of allLocations) {
      const locAddress = location.fields['Full Address'];
      const name = location.fields['Location Name'];
      const isPremium = location.fields['isPremium'];
      const pinColor = isPremium ? 'gold' : 'red';

      // Geocode the location's address to get coordinates
      mapboxClient
        .forwardGeocode({
          query: locAddress,
          autocomplete: false,
          limit: 1
        })
        .send()
        .then((locResponse) => {
          if (!locResponse.body.features.length) return;
          const locCoords = locResponse.body.features[0].center;

          // Calculate distance using Haversine formula
          const distanceInMiles = haversineDistance(searchCoords, locCoords);

          if (radius === 'any' || distanceInMiles <= radius) {
            const marker = new mapboxgl.Marker({ color: pinColor })
              .setLngLat(locCoords)
              .setPopup(new mapboxgl.Popup().setText(name))
              .addTo(mapInstance);

            marker.getElement().addEventListener('click', () => {
              openModal(location.fields);
            });

            bounds.extend(locCoords);
            hasValidCoords = true;
          }
        })
        .catch((error) => {
          console.error(`Error geocoding address: ${locAddress}`, error);
        });
    }

    if (hasValidCoords) {
      mapInstance.fitBounds(bounds, { padding: 50 });
    }
  };

  useEffect(() => {
    // Initialize the map only once
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-98.5795, 39.8283], // Set initial center to US
      zoom: 4 // Set zoom level for better visibility
    });
    setMapInstance(map);

    // Fetch Airtable locations and user's location on load
    fetchLocationsOnce();
    getUserLocation();

    return () => map.remove(); // Cleanup on unmount
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
        <button onClick={() => runSearch(userLocation, searchRadius)}>Search</button>
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
