// Test Airtable connection
export default async function handler(req, res) {
  const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;
  const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY;
  const AIRTABLE_TABLE_ID = process.env.NEXT_PUBLIC_AIRTABLE_TABLE_ID;
  const AIRTABLE_VIEW_ID = process.env.NEXT_PUBLIC_AIRTABLE_VIEW_ID;

  console.log("Testing Airtable connection with:", {
    baseId: AIRTABLE_BASE_ID,
    tableId: AIRTABLE_TABLE_ID,
    viewId: AIRTABLE_VIEW_ID,
    apiKey: AIRTABLE_API_KEY
      ? `${AIRTABLE_API_KEY.substring(0, 10)}...`
      : "MISSING",
  });

  try {
    // Test with returnFieldsByFieldId=true
    const testUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?view=${AIRTABLE_VIEW_ID}&returnFieldsByFieldId=true&maxRecords=1`;

    const response = await fetch(testUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    console.log("Airtable test response:", {
      status: response.status,
      statusText: response.statusText,
      url: testUrl,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable error response:", errorText);
      return res.status(403).json({
        error: "Airtable API error",
        status: response.status,
        statusText: response.statusText,
        details: errorText,
      });
    }

    const data = await response.json();
    return res.status(200).json({
      success: true,
      recordCount: data.records.length,
      sampleRecord: data.records[0],
      availableFields: data.records[0]
        ? Object.keys(data.records[0].fields)
        : [],
    });
  } catch (error) {
    console.error("Airtable test error:", error);
    return res.status(500).json({
      error: "Failed to connect to Airtable",
      details: error.message,
    });
  }
}
