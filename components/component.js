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

const Component = () => {
  const mapContainer = React.useRef(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [searchRadius, setSearchRadius] = useState(50);
  const [locations, setLocations] = useState([]);

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

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        const userLocation = [longitude, latitude];
        setUserLocation(userLocation);
        setSearchAddress(`${latitude}, ${longitude}`);
        runSearch(`${latitude}, ${longitude}`, 50); // Run initial search with default 50 miles radius
      });
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  };

  const runSearch = async (address, radius) => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-98.5795, 39.8283], // Set initial center to US
      zoom: 4 // Set zoom level for better visibility
    });

    const allLocations = await fetchLocations();
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidCoords = false;

    // Geocode the search address to get coordinates
    const searchResponse = await mapboxClient.forwardGeocode({ query: address, limit: 1 }).send();
    if (!searchResponse.body.features.length) return;
    const searchCoords = searchResponse.body.features[0].center;

    // Loop through locations and filter by radius
    for (const location of allLocations) {
      const locAddress = location.fields['Full Address'];
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

        // Calculate distance between search location and current location
        const distance = mapboxgl.MercatorCoordinate.fromLngLat(searchCoords).distanceTo(mapboxgl.MercatorCoordinate.fromLngLat(locCoords));
        const distanceInMiles = distance / 1609.34;

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
    getUserLocation();
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

