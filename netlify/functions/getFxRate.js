exports.handler = async function (event) {
  const VERSION = "fx-v5-slice-parser-2026-03-09";

  try {
    const currency = String(
      event.queryStringParameters?.currency || "TWD"
    ).toUpperCase();

    if (!["TWD", "USD", "EUR"].includes(currency)) {
      return json(400, { error: "Unsupported currency", version: VERSION });
    }

    if (currency === "TWD") {
      return json(200, {
        currency: "TWD",
        rate: 1,
        rateType: "self",
        source: "local",
        fetchedAt: new Date().toISOString(),
        version: VERSION,
      });
    }

    const res = await fetch("https://rate.bot.com.tw/xrt?Lang=zh-TW", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`BOT fetch failed: ${res.status}`);
    }

    const html = await res.text();
    const rate = extractSpotSellFromBotHtml(html, currency);

    if (rate == null) {
      return json(500, {
        error: `Rate not found for ${currency}`,
        version: VERSION,
        debug: {
          status: res.status,
          contentType: res.headers.get("content-type"),
          head: html.slice(0, 300),
        },
      });
    }

    return json(200, {
      currency,
      rate,
      rateType: "spot_sell",
      source: "Bank of Taiwan",
      fetchedAt: new Date().toISOString(),
      version: VERSION,
    });
  } catch (err) {
    console.error("getFxRate error:", err);
    return json(500, {
      error: err.message || "Unknown error",
      version: VERSION,
      stack: err.stack || null,
    });
  }
};

function extractSpotSellFromBotHtml(html, currency) {
  const upper = String(currency || "").toUpperCase();

  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const marker = `(${upper})`;
  const start = text.indexOf(marker);
  if (start === -1) return null;

  // 只看幣別後面一小段，避免抓到後面別的幣別
  const chunk = text.slice(start, start + 220);

  // 抓這段裡前 4 個數字
  const nums = chunk.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 4) return null;

  // 順序：現金買入、現金賣出、即期買入、即期賣出
  const spotSell = Number(nums[3]);

  return Number.isFinite(spotSell) && spotSell > 0 ? spotSell : null;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}