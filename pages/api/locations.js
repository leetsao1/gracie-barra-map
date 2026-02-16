/**
 * Server-side API route for fetching locations from Airtable
 * Protects API keys from client exposure
 */

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get parameters from query
  const { forceRefresh = 'false' } = req.query;

  // Server-side environment variables (NO NEXT_PUBLIC_ prefix)
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;
  const AIRTABLE_VIEW_ID = process.env.AIRTABLE_VIEW_ID;
  const LATITUDE_FIELD_ID = process.env.AIRTABLE_LATITUDE_FIELD_ID;
  const LONGITUDE_FIELD_ID = process.env.AIRTABLE_LONGITUDE_FIELD_ID;
  const ADDRESS_FIELD_ID = process.env.AIRTABLE_ADDRESS_FIELD_ID;
  const SCHOOL_FIELD_ID = process.env.AIRTABLE_SCHOOL_FIELD_ID;
  const HEAD_INSTRUCTOR_FIELD_ID = process.env.AIRTABLE_HEAD_INSTRUCTOR_FIELD_ID;
  const PHONE_FIELD_ID = process.env.AIRTABLE_PHONE_FIELD_ID;
  const EMAIL_FIELD_ID = process.env.AIRTABLE_EMAIL_FIELD_ID;
  const WEBSITE_FIELD_ID = process.env.AIRTABLE_WEBSITE_FIELD_ID;
  const IS_PREMIUM_FIELD_ID = process.env.AIRTABLE_IS_PREMIUM_FIELD_ID;
  const COUNTRY_FIELD_ID = process.env.AIRTABLE_COUNTRY_FIELD_ID;
  const REGION_FIELD_ID = process.env.AIRTABLE_REGION_FIELD_ID;
  const SCHOOL_ADDRESS_FIELD_ID = process.env.AIRTABLE_SCHOOL_ADDRESS_FIELD_ID;
  const GB_NAME_FIELD_ID = process.env.AIRTABLE_GB_NAME_FIELD_ID;

  // Validate required env variables
  if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !AIRTABLE_TABLE_ID) {
    console.error('Missing required Airtable environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    let allRecords = [];
    let offset = null;
    let retryCount = 0;
    const maxRetries = 3;

    // Build field list
    const fields = [];
    if (ADDRESS_FIELD_ID) fields.push(ADDRESS_FIELD_ID);
    if (SCHOOL_FIELD_ID) fields.push(SCHOOL_FIELD_ID);
    if (HEAD_INSTRUCTOR_FIELD_ID) fields.push(HEAD_INSTRUCTOR_FIELD_ID);
    if (PHONE_FIELD_ID) fields.push(PHONE_FIELD_ID);
    if (EMAIL_FIELD_ID) fields.push(EMAIL_FIELD_ID);
    if (WEBSITE_FIELD_ID) fields.push(WEBSITE_FIELD_ID);
    if (IS_PREMIUM_FIELD_ID) fields.push(IS_PREMIUM_FIELD_ID);
    if (COUNTRY_FIELD_ID) fields.push(COUNTRY_FIELD_ID);
    if (REGION_FIELD_ID) fields.push(REGION_FIELD_ID);
    if (LATITUDE_FIELD_ID) fields.push(LATITUDE_FIELD_ID);
    if (LONGITUDE_FIELD_ID) fields.push(LONGITUDE_FIELD_ID);
    if (SCHOOL_ADDRESS_FIELD_ID) fields.push(SCHOOL_ADDRESS_FIELD_ID);
    if (GB_NAME_FIELD_ID) fields.push(GB_NAME_FIELD_ID);

    const fieldsParam = fields
      .map((field) => `fields[]=${encodeURIComponent(field)}`)
      .join("&");

    // Fetch with pagination and retry logic
    do {
      retryCount = 0;
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?view=${AIRTABLE_VIEW_ID}&returnFieldsByFieldId=true&${fieldsParam}`;

      if (offset) {
        url += `&offset=${offset}`;
      }

      let response;
      let success = false;

      // Retry loop for rate limiting
      while (!success && retryCount < maxRetries) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${AIRTABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (response.status === 429) {
            // Rate limited - wait and retry
            retryCount++;
            const retryAfter = response.headers.get('Retry-After') || Math.pow(2, retryCount);
            console.warn(`Airtable rate limit hit. Retrying after ${retryAfter}s (attempt ${retryCount}/${maxRetries})`);

            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          if (!response.ok) {
            throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
          }

          success = true;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error;
          }
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }

      if (!success) {
        throw new Error('Max retries exceeded');
      }

      const data = await response.json();

      // Filter records that have coordinates
      const validRecords = data.records.filter(
        (record) =>
          record.fields[LONGITUDE_FIELD_ID] &&
          record.fields[LATITUDE_FIELD_ID]
      );

      allRecords = [...allRecords, ...validRecords];
      offset = data.offset;

      // Add small delay between pagination requests to avoid rate limiting
      if (offset) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } while (offset);

    // Set cache headers (5 minutes)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    // Return successful response
    return res.status(200).json({
      records: allRecords,
      count: allRecords.length,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Airtable API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch locations',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
