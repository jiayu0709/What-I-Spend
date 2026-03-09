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

    const res = await fetch("https://www.bot.com.tw/tw/personal-banking/foreign-exchange", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) {
      throw new Error(`BOT fetch failed: ${res.status}`);
    }

    const html = await res.text();
    const rate = extractSpotSellRateFromBot(html, currency);

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

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function extractSpotSellRateFromBot(html, currency) {
  const upper = String(currency || "").toUpperCase();

  // 先抓該幣別區塊，例如 USD / EUR
  const blockRegex = new RegExp(
    `${upper}[\\s\\S]{0,800}?即期賣出[\\s\\S]{0,120}?([0-9]+(?:\\.[0-9]+)?)`,
    "i"
  );
  const match = html.match(blockRegex);

  if (!match) return null;

  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}