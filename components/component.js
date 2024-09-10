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

const Component = () => {
  const mapContainer = React.useRef(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  const fetchLocations = async () => {
    try {
      const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?view=${AIRTABLE_VIEW_NAME}`, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`
        }
      });
      const data = await response.json();
      return data.records;
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

  useEffect(() => {
    const initMap = async () => {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-98.5795, 39.8283],
        zoom: 4
      });

      const locations = await fetchLocations();
      const bounds = new mapboxgl.LngLatBounds();

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

          if (!response.body.features.length) continue;
          const feature = response.body.features[0];
          const coords = feature.center;

          const marker = new mapboxgl.Marker({ color: pinColor })
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup().setText(name))
            .addTo(map);

          marker.getElement().addEventListener('click', () => {
            openModal(location.fields);
          });

          bounds.extend(coords);
        } catch (error) {
          console.error(`Error geocoding address: ${address}`, error);
        }
      }

      map.fitBounds(bounds, { padding: 50 });
    };

    initMap();
  }, []);

  return (
    <div>
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
