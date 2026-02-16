/**
 * Server-side API route for geocoding addresses
 * Protects Mapbox API key from client exposure
 * Implements rate limiting and caching
 */

import mapboxSdk from "@mapbox/mapbox-sdk/services/geocoding";

// Initialize Mapbox client (server-side only)
let mapboxClient;

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize client if not already done
  if (!mapboxClient) {
    const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
    if (!MAPBOX_TOKEN) {
      return res.status(500).json({ error: 'Mapbox token not configured' });
    }
    mapboxClient = mapboxSdk({ accessToken: MAPBOX_TOKEN });
  }

  const { addresses, type = 'forward' } = req.body;

  if (!addresses || !Array.isArray(addresses)) {
    return res.status(400).json({ error: 'Invalid request: addresses array required' });
  }

  // Limit batch size
  if (addresses.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 addresses per request' });
  }

  try {
    const results = [];

    // Process in batches of 5 with delays to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (address) => {
          try {
            if (type === 'forward') {
              // Forward geocoding: address -> coordinates
              const response = await mapboxClient
                .forwardGeocode({
                  query: address,
                  limit: 1,
                  types: ["address", "place", "poi"],
                  language: ["en"],
                  autocomplete: false,
                  fuzzyMatch: false,
                })
                .send();

              if (response.body.features.length) {
                return {
                  address,
                  coordinates: response.body.features[0].center,
                  success: true
                };
              }
              return { address, success: false };
            } else if (type === 'reverse') {
              // Reverse geocoding: coordinates -> address
              const response = await mapboxClient
                .reverseGeocode({
                  query: address, // Should be [lng, lat]
                  limit: 1,
                })
                .send();

              if (response.body.features.length) {
                return {
                  coordinates: address,
                  address: response.body.features[0].place_name,
                  success: true
                };
              }
              return { coordinates: address, success: false };
            }
          } catch (error) {
            console.error(`Geocoding error for ${address}:`, error.message);
            return { address, success: false, error: error.message };
          }
        })
      );

      results.push(...batchResults);

      // Add delay between batches (200ms)
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Set cache headers (1 hour for geocoding results)
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');

    return res.status(200).json({
      results,
      count: results.length,
      successful: results.filter(r => r.success).length
    });

  } catch (error) {
    console.error('Geocoding API error:', error);
    return res.status(500).json({
      error: 'Geocoding failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
