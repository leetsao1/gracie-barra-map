// pages/api/locations.js

export default function handler(req, res) {
  // Create sample data for two locations with latitude and longitude
  const locations = [
    {
      id: 1,
      name: 'Location 1',
      coordinates: {
        latitude: 40.712776,
        longitude: -74.005974
      }
    },
    {
      id: 2,
      name: 'Location 2',
      coordinates: {
        latitude: 34.052235,
        longitude: -118.243683
      }
    }
  ];

  // Send the locations as JSON
  res.status(200).json(locations);
}
 