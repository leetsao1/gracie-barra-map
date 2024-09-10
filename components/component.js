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

// Modal setup
Modal.setAppElement('#root');

const Component = () => {
  const mapContainer = React.useRef(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Function to open the modal with data
  const openModal = (location) => {
    setSelectedLocation(location);
    setModalIsOpen(true);
  };

  // Function to close the modal
  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedLocation(null);
  };

  // Function to fetch locations from Airtable with pagination handling
  const fetchLocations = async () => {
    let allRecords = [];
    let offset = null;

    try {
      do {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?view=${AIRTABLE_VIEW_NAME}${offset ? `&offset=${offset}` : ''}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`
          }
        });

        const data = await response.json();
        allRecords = [...allRecords, ...data.records];

        // If there's more data to fetch, Airtable will return an offset
        offset = data.offset;
      } while (offset); // Continue fetching until there's no offset
    } catch (error) {
      console.error("Error fetching data from Airtable:", error);
    }

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
        const isPremium = location.fields['isPremium'];
        const pinColor = isPremium ? 'gold' : 'red';

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

          // Add marker to the map
          const markerEl = document.createElement('div');
          markerEl.style.backgroundColor = pinColor;
          markerEl.style.width = '20px';
          markerEl.style.height = '20px';
          markerEl.style.borderRadius = '50%';

          const marker = new mapboxgl.Marker({ element: markerEl })
            .setLngLat(coords)
            .addTo(map);

          // Open modal when marker is clicked
          marker.getElement().addEventListener('click', () => openModal(location));

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
      }
    };

    initMap(); // Call the function to initialize the map
  }, []);

  return (
    <div>
      <div ref={mapContainer} className={styles.mapContainer} />

      {/* Modal for displaying additional location details */}
      {selectedLocation && (
        <Modal
          isOpen={modalIsOpen}
          onRequestClose={closeModal}
          contentLabel="Location Details"
          className={styles.modalContent}
          overlayClassName={styles.modalOverlay}
        >
          <h2>{selectedLocation.fields['Location Name']}</h2>
          <p><strong>Full Address:</strong> {selectedLocation.fields['Full Address']}</p>
          <p><strong>Website:</strong> <a href={selectedLocation.fields['Website']} target="_blank" rel="noopener noreferrer">{selectedLocation.fields['Website']}</a></p>
          <p><strong>Instructor:</strong> {selectedLocation.fields['Instructor']}</p>
          <p><strong>Phone Number:</strong> {selectedLocation.fields['Phone Number']}</p>
          <button onClick={closeModal}>Close</button>
        </Modal>
      )}
    </div>
  );
};

export default Component;
