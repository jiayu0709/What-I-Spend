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

    // 臺灣銀行 plain file
    const res = await fetch("https://rate.bot.com.tw/xrt/fltxt/0/day", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) {
      throw new Error(`BOT fetch failed: ${res.status}`);
    }

    const text = await res.text();
    const rate = extractBotSpotSellRate(text, currency);

    if (!rate) {
      throw new Error(`Rate not found for ${currency}`);
    }

    return json(200, {
      currency,
      rate,
      rateType: "spot_sell",
      source: "Bank of Taiwan",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("getFxRate error:", err);
    return json(500, { error: err.message || "Unknown error" });
  }
}

function extractBotSpotSellRate(text, currency) {
  const upper = String(currency || "").toUpperCase();

  // plain file 格式類似：
  // USD Buying 31.28000 31.60500 ... Selling 31.95000 31.75500 ...
  // EUR Buying 35.71000 36.22500 ... Selling 37.05000 36.82500 ...
  //
  // 我們要的是 Spot Selling
  // => Selling 後面的第 2 個數字

  const regex = new RegExp(
    `\\b${upper}\\b\\s+Buying\\s+([0-9.]+)\\s+([0-9.]+)(?:\\s+[0-9.]+){0,20}\\s+Selling\\s+([0-9.]+)\\s+([0-9.]+)`,
    "i"
  );

  const match = text.match(regex);
  if (!match) return null;

  const spotSelling = Number(match[4]);
  return Number.isFinite(spotSelling) && spotSelling > 0 ? spotSelling : null;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}