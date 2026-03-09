export async function handler(event) {
  try {
    const from = String(event.queryStringParameters?.from || "").toUpperCase();
    const to = String(event.queryStringParameters?.to || "").toUpperCase();

    if (!from || !to) {
      return json(400, { error: "Missing from/to currency" });
    }

    if (from === to) {
      return json(200, {
        from,
        to,
        rate: 1,
        source: "self",
        fetchedAt: new Date().toISOString(),
      });
    }

    const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Frankfurter fetch failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const rate = Number(data?.rates?.[to]);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Rate not found for ${from}->${to}`);
    }

    return json(200, {
      from,
      to,
      rate,
      date: data?.date || null,
      source: "Frankfurter",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("getDisplayRate error:", err);
    return json(500, { error: err.message || "Unknown error" });
  }
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