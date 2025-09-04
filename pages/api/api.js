// pages/api/locations.js
import { fetchLocations } from '../../services/airtable.js';

export default async function handler(req, res) {
  try {
    const locations = await fetchLocations();
    res.status(200).json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
}
 