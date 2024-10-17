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

const premiumOptions = [
  { value: 'all', label: 'All locations' },
  { value: 'premium', label: 'Premium only' },
];

// Custom Modal styles to override react-modal default styles
const customModalStyles = (pinColor) => ({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 1000, // Ensure modal overlay is above other content
  },
  content: {
    position: 'relative',
    inset: 0,
    margin: 'auto',
    width: '70%',
    maxWidth: '90%',
    borderRadius: '12px',
    padding: '30px',
    backgroundColor: '#fff',
    border: `3px solid ${pinColor}`, // Set border color to match pin color
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)', // Custom box shadow
  },
});

// Haversine formula to calculate distance between two latitude/longitude points
function haversineDistance(coords1, coords2) {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371e3; // Earth radius in meters
  const ϕ1 = lat1 * Math.PI / 180;
  const ϕ2 = lat2 * Math.PI / 180;
  const Δϕ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δϕ / 2) * Math.sin(Δϕ / 2) +
            Math.cos(ϕ1) * Math.cos(ϕ2) *
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
  const [premiumFilter, setPremiumFilter] = useState('all'); // New state for premium filter
  const [isCollapsed, setIsCollapsed] = useState(false); // State to handle collapse/expand
  const [loading, setLoading] = useState(false); // Add loading state
  const [pinColor, setPinColor] = useState('red');

   // Toggle the collapsed state of the search section
  const toggleCollapse = () => {
    setIsCollapsed(prevState => !prevState);
  };

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

  const openModal = (data, color) => {
    setModalData(data);
    setPinColor(color);
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

  const runSearch = async (addressOrCoords, radius, premiumFilter) => {
    console.log("running search...");
    if (!map) return; // Ensure map is initialized

    setLoading(true); // Set loading to true when search starts

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

    // Loop through locations and filter by radius and premium status
    for (const location of allLocations) {
      const locAddress = location.fields['Address for Geolocation'];
      const name = location.fields['Location Name'];
      const isPremium = location.fields['isPremium'];
      const pinColor = isPremium ? 'gold' : 'red';

      // Apply premium filter: skip non-premium locations if "premium only" is selected
      if (premiumFilter === 'premium' && !isPremium) continue;

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
            openModal(location.fields, pinColor);
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

    if (window.innerWidth <= 768) {
      setIsCollapsed(true);
    }
    if (map) {
      setTimeout(() => {
        map.resize(); // Resize map after the search section collapses
      }, 300);
    }

     setLoading(false); // Set loading to false when search ends
  };

 useEffect(() => {
    if (map) {
      runSearch(searchAddress, searchRadius, premiumFilter);
    }
  }, [map, premiumFilter]);

  useEffect(() => {
    getUserLocationAndSearch(); // On component mount, get user's location and trigger search
  }, []);

 return (
    <div className={styles.container}>
      {/* Toggle button to expand/collapse the search section */}
      <button onClick={toggleCollapse} className={styles.toggleButton}>
        {isCollapsed ? 'Expand Search' : 'Collapse Search'}
      </button>

      {/* Conditionally render the search section based on collapse state */}
      {!isCollapsed && (
        <div className={styles.searchContainer}>
          <div className={styles.searchControls}>
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Enter address"
              className={styles.searchInput}
            />
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(e.target.value)}
              className={styles.searchSelect}
            >
              <option value={10}>10 miles</option>
              <option value={25}>25 miles</option>
              <option value={50}>50 miles</option>
              <option value={100}>100 miles</option>
              <option value="any">Any distance</option>
            </select>
            <select
              value={premiumFilter}
              onChange={(e) => setPremiumFilter(e.target.value)}
              className={styles.searchSelect}
            >
              <option value="all">All locations</option>
              <option value="premium">Premium only</option>
            </select>
            <button onClick={() => runSearch(searchAddress, searchRadius, premiumFilter)} className={styles.searchButton}>
              Search
            </button>
              {/* Conditionally render loading gif if search is in progress */}
            {loading && <img src="/loading.gif" alt="Loading..." className={styles.loadingGif} />}
          </div>
        </div>
      )}

      <div ref={mapContainer} className={styles.mapContainer} />

      <Modal isOpen={modalIsOpen} onRequestClose={closeModal} contentLabel="Location Details" style={customModalStyles(pinColor)} >
        {modalData && (
          <div className={styles.modalContent}>
            <h2>{modalData['Location Name']}</h2>
            <p><strong>Full Address:</strong> {modalData['Full Address']}</p>
            <p><strong>Instructor:</strong> {modalData['Instructor']}</p>
            <p><strong>Phone Number:</strong> {modalData['Phone Number']}</p>
            <p><strong>Website:</strong> <a href={modalData['Website']} target="_blank" rel="noopener noreferrer">{modalData['Website']}</a></p>
            <div className={styles.alertBlock}>
              <strong>Premium Location:</strong> Gracie Barra Premium Schools are academies that meet a higher standard of excellence within the Gracie Barra network. These schools go beyond the basic operational standards, reflecting the highest level of compliance with Gracie Barra’s methodology, facilities, and service quality.
            </div>
            <button onClick={closeModal}>Close</button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Component;
