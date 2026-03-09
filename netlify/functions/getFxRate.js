export async function handler(event) {
  try {
    const currency = String(event.queryStringParameters?.currency || "TWD").toUpperCase();

    if (!["TWD", "USD", "EUR"].includes(currency)) {
      return json(400, { error: "Unsupported currency" });
    }

    if (currency === "TWD") {
      return json(200, {
        currency: "TWD",
        rate: 1,
        rateType: "self",
        source: "local",
        fetchedAt: new Date().toISOString(),
      });
    }

    const itemCode = currency === "USD" ? "BP01D01en" : "BP01D02en";
    const url = `https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=${itemCode}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      throw new Error(`CBC fetch failed: ${res.status}`);
    }

    const data = await res.json();
    const rate = extractLatestRateFromCBC(data);

    if (!rate) {
      throw new Error(`Rate not found for ${currency}`);
    }

    return json(200, {
      currency,
      rate,
      rateType: "daily",
      source: "Central Bank of the Republic of China (Taiwan)",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("getFxRate error:", err);
    return json(500, { error: err.message || "Unknown error" });
  }
}

function extractLatestRateFromCBC(payload) {
  const rows = payload?.dataSet || payload?.DataSet || payload?.dataset || [];
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const last = rows[rows.length - 1];

  const candidates = [
    last?.value,
    last?.Value,
    last?.dataValue,
    last?.DataValue,
    last?.ClosingRate,
    last?.closingRate,
  ];

  for (const v of candidates) {
    const n = Number(String(v ?? "").replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }

  for (const val of Object.values(last || {})) {
    const n = Number(String(val ?? "").replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}