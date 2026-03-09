export async function handler(event) {
  try {
    const currency = String(event.queryStringParameters?.currency || "TWD").toUpperCase();

    if (!["TWD", "USD", "EUR"].includes(currency)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Unsupported currency" }),
      };
    }

    if (currency === "TWD") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          currency: "TWD",
          rate: 1,
          rateType: "self",
          source: "local",
          fetchedAt: new Date().toISOString(),
        }),
      };
    }

    const res = await fetch("https://rate.bot.com.tw/xrt?Lang=zh-TW", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) {
      throw new Error(`BOT fetch failed: ${res.status}`);
    }

    const html = await res.text();

    const rate = extractSpotSellRate(html, currency);

    if (!rate) {
      throw new Error(`Rate not found for ${currency}`);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        currency,
        rate,
        rateType: "spot_sell",
        source: "Bank of Taiwan",
        fetchedAt: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error("getFxRate error:", err);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        error: err.message || "Unknown error",
      }),
    };
  }
}

function extractSpotSellRate(html, currency) {
  const upper = String(currency || "").toUpperCase();

  // 先抓包含幣別代碼的整列，例如 (USD) / (EUR)
  const rowRegex = new RegExp(
    `<tr[^>]*>[\\s\\S]*?\$begin:math:text$\$\{upper\}\\$end:math:text$[\\s\\S]*?<\\/tr>`,
    "i"
  );
  const rowMatch = html.match(rowRegex);
  if (!rowMatch) return null;

  const rowHtml = rowMatch[0];

  // 抓該列所有 td
  const tdRegex = /<td[^>]*data-table="([^"]+)"[^>]*>([\s\S]*?)<\/td>/gi;
  const cells = [];
  let m;

  while ((m = tdRegex.exec(rowHtml)) !== null) {
    const key = stripTags(m[1]).trim();
    const value = stripTags(m[2]).trim().replace(/,/g, "");
    cells.push({ key, value });
  }

  // 優先找：即期匯率 / 本行賣出
  let target = cells.find(
    (x) => x.key.includes("即期匯率") && x.key.includes("本行賣出")
  );

  // 有些頁面結構可能不是這個文字，退而求其次抓只包含「本行賣出」
  if (!target) {
    target = cells.find((x) => x.key.includes("本行賣出"));
  }

  if (!target) return null;

  const n = Number(target.value);
  return Number.isFinite(n) ? n : null;
}

function stripTags(str) {
  return String(str)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ");
}