// Debug Airtable connection with different approaches
export default async function handler(req, res) {
  const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;
  const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY;
  const AIRTABLE_TABLE_ID = process.env.NEXT_PUBLIC_AIRTABLE_TABLE_ID;
  const AIRTABLE_VIEW_ID = process.env.NEXT_PUBLIC_AIRTABLE_VIEW_ID;

  console.log("Debugging Airtable with:", {
    baseId: AIRTABLE_BASE_ID,
    tableId: AIRTABLE_TABLE_ID,
    viewId: AIRTABLE_VIEW_ID,
    apiKey: AIRTABLE_API_KEY
      ? `${AIRTABLE_API_KEY.substring(0, 10)}...`
      : "MISSING",
  });

  const results = {};

  try {
    // Test 1: Using table ID and view ID (current approach)
    console.log("Test 1: Using table ID and view ID");
    const url1 = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?view=${AIRTABLE_VIEW_ID}&maxRecords=1`;
    console.log("URL 1:", url1);

    const response1 = await fetch(url1, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    results.test1 = {
      url: url1,
      status: response1.status,
      statusText: response1.statusText,
      success: response1.ok,
    };

    if (!response1.ok) {
      const errorText1 = await response1.text();
      results.test1.error = errorText1;
    } else {
      const data1 = await response1.json();
      results.test1.data = data1;
    }

    // Test 2: Using table name instead of ID
    console.log("Test 2: Using table name instead of ID");
    const url2 = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Locations?view=${AIRTABLE_VIEW_ID}&maxRecords=1`;
    console.log("URL 2:", url2);

    const response2 = await fetch(url2, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    results.test2 = {
      url: url2,
      status: response2.status,
      statusText: response2.statusText,
      success: response2.ok,
    };

    if (!response2.ok) {
      const errorText2 = await response2.text();
      results.test2.error = errorText2;
    } else {
      const data2 = await response2.json();
      results.test2.data = data2;
    }

    // Test 3: Using view name instead of ID
    console.log("Test 3: Using view name instead of ID");
    const url3 = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?view=Grid%20view&maxRecords=1`;
    console.log("URL 3:", url3);

    const response3 = await fetch(url3, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    results.test3 = {
      url: url3,
      status: response3.status,
      statusText: response3.statusText,
      success: response3.ok,
    };

    if (!response3.ok) {
      const errorText3 = await response3.text();
      results.test3.error = errorText3;
    } else {
      const data3 = await response3.json();
      results.test3.data = data3;
    }

    // Test 4: Using both table name and view name
    console.log("Test 4: Using both table name and view name");
    const url4 = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Locations?view=Grid%20view&maxRecords=1`;
    console.log("URL 4:", url4);

    const response4 = await fetch(url4, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    results.test4 = {
      url: url4,
      status: response4.status,
      statusText: response4.statusText,
      success: response4.ok,
    };

    if (!response4.ok) {
      const errorText4 = await response4.text();
      results.test4.error = errorText4;
    } else {
      const data4 = await response4.json();
      results.test4.data = data4;
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error("Debug error:", error);
    return res.status(500).json({
      error: "Debug failed",
      details: error.message,
      results,
    });
  }
}
