// netlify/functions/addTransaction.js
import admin from "firebase-admin";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  const sa = JSON.parse(raw);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return sa;
}

function initAdmin() {
  if (admin.apps.length) return;

  const serviceAccount = getServiceAccountFromEnv();
  if (!serviceAccount) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });

  // API Key 驗證（捷徑要帶 X-API-Key）
  const apiKey = event.headers["x-api-key"] || event.headers["X-API-Key"];
  if (!process.env.API_KEY || apiKey !== process.env.API_KEY) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
    console.log("raw body:", event.body);
    console.log("parsed data:", data);
    console.log("keys:", Object.keys(data || {}));
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const amount = Number(data.amount);
  const category = String(data.category || "").trim();
  const note = (data.note == null ? "" : String(data.note)).trim();
  const date = String(data.date || "").trim(); // YYYY-MM-DD

  if (!Number.isFinite(amount) || amount <= 0) return json(400, { ok: false, error: "amount must be > 0" });
  if (!category) return json(400, { ok: false, error: "category is required" });
  if (!date) return json(400, { ok: false, error: "date is required" });

  try {
    initAdmin();
    const db = admin.firestore();

    // ✅ 先用這個 collection 名：transactions
    // 如果你原本前端用別的名字，之後我再帶你改成一致
    const ref = await db.collection("transactions").add({
      amount,
      category,
      note,
      date,
      source: "shortcut",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return json(200, { ok: true, id: ref.id });
  } catch (e) {
    console.error(e);
    return json(500, { ok: false, error: "Server error" });
  }
};