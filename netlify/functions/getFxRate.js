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
        source: "CBC",
        fetchedAt: new Date().toISOString(),
      });
    }

    // 中央銀行：Spot Exchange Rates（月資料）
    const res = await fetch("https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=EG52M01en", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      throw new Error(`CBC fetch failed: ${res.status}`);
    }

    const payload = await res.json();

    // 先把資料印出來，看實際欄位名稱
    console.log("CBC payload keys:", Object.keys(payload || {}));
    console.log("CBC sample row:", payload?.DataSet?.[payload?.DataSet?.length - 1] || payload?.dataSet?.[payload?.dataSet?.length - 1] || null);

    const rate = extractLatestMonthlyRate(payload, currency);

    if (!rate) {
      throw new Error(`Rate not found for ${currency}`);
    }

    return json(200, {
      currency,
      rate,
      rateType: "monthly",
      source: "Central Bank of the Republic of China (Taiwan)",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("getFxRate error:", err);
    return json(500, { error: err.message || "Unknown error" });
  }
}

function extractLatestMonthlyRate(payload, currency) {
  const rows = payload?.DataSet || payload?.dataSet || [];
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const last = rows[rows.length - 1];

  // 先試常見欄位名
  const candidates = [
    currency,
    currency.toLowerCase(),
    `${currency}SpotRate`,
    `${currency}_spot`,
    `${currency}_rate`,
  ];

  for (const key of candidates) {
    if (key in last) {
      const n = Number(String(last[key] ?? "").replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  // 最後退一步：掃描欄位名裡包含 EUR / USD 的欄位
  for (const [key, val] of Object.entries(last || {})) {
    if (String(key).toUpperCase().includes(currency)) {
      const n = Number(String(val ?? "").replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
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