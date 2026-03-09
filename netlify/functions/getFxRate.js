export async function handler(event) {
  try {
    const currency = String(
      event.queryStringParameters?.currency || "TWD"
    ).toUpperCase();

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

    const res = await fetch("https://rate.bot.com.tw/xrt/fltxt/0/day", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/plain,text/html;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`BOT fetch failed: ${res.status}`);
    }

    const text = await res.text();

    // 先留一點 debug，部署後很好查
    console.log("BOT raw head:", text.slice(0, 300));

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

  // 去掉 BOM、換行，壓成單一空白
  const normalized = String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized.split(" ");
  const idx = tokens.indexOf(upper);

  if (idx === -1) {
    console.error("Currency token not found:", upper);
    return null;
  }

  // 預期格式：
  // USD Buying [9個數字] Selling [9個數字]
  if (tokens[idx + 1] !== "Buying") {
    console.error("Buying token not found after currency:", upper);
    return null;
  }

  const sellingIdx = tokens.indexOf("Selling", idx + 2);
  if (sellingIdx === -1) {
    console.error("Selling token not found for currency:", upper);
    return null;
  }

  const sellingNumbers = [];
  for (let i = sellingIdx + 1; i < tokens.length; i++) {
    const t = tokens[i];

    // 遇到下一個幣別代碼就停
    if (/^[A-Z]{3}$/.test(t)) break;

    if (/^\d+(\.\d+)?$/.test(t)) {
      sellingNumbers.push(Number(t));
    }
  }

  // Selling 後第 1 個 = 現金賣出
  // Selling 後第 2 個 = 即期賣出
  const spotSelling = sellingNumbers[1];

  return Number.isFinite(spotSelling) && spotSelling > 0
    ? spotSelling
    : null;
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

export async function handler(event) {
  const VERSION = "fx-v3-debug-2026-03-09";

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

    const res = await fetch("https://rate.bot.com.tw/xrt/fltxt/0/day", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/plain,text/html;q=0.9,*/*;q=0.8",
      },
    });

    const text = await res.text();

    const normalized = String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const tokens = normalized.split(" ");
    const idx = tokens.indexOf(currency);
    const sellingIdx = tokens.indexOf("Selling", idx + 2);

    console.log("VERSION =", VERSION);
    console.log("status =", res.status);
    console.log("content-type =", res.headers.get("content-type"));
    console.log("raw head =", text.slice(0, 300));
    console.log("currency =", currency);
    console.log("idx =", idx);
    console.log("token after currency =", tokens[idx + 1]);
    console.log("sellingIdx =", sellingIdx);
    console.log("token window =", tokens.slice(Math.max(0, idx - 3), idx + 25));

    const rate = extractBotSpotSellRate(text, currency);

    if (rate == null) {
      return json(500, {
        error: `Rate not found for ${currency}`,
        version: VERSION,
        debug: {
          status: res.status,
          contentType: res.headers.get("content-type"),
          idx,
          tokenAfterCurrency: tokens[idx + 1] || null,
          sellingIdx,
          rawHead: text.slice(0, 200),
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
      version: "fx-v3-debug-2026-03-09",
    });
  }
}