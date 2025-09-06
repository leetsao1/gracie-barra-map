// pages/api/locations.js
import { fetchLocations } from "../../services/airtable.js";

export default async function handler(req, res) {
  try {
    console.log("API route called - fetching locations...");
    const locations = await fetchLocations();
    console.log("Locations fetched:", locations.length);
    console.log("Sample location:", locations[0]);
    res.status(200).json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
}
