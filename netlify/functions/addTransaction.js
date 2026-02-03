// netlify/functions/addTransaction.js
import admin from "firebase-admin";

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      // ✅ 讓 Authorization / X-API-Key 都能過
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...extraHeaders,
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

function getBearerToken(headers = {}) {
  const h = headers.authorization || headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });

  initAdmin();

  // ========= 1) 解析 JSON =========
  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  // ✅ 防呆：把 key 前後空白去掉（避免 category␠ 那種）
  const cleaned = {};
  for (const [k, v] of Object.entries(data || {})) cleaned[String(k).trim()] = v;
  data = cleaned;

  // ========= 2) 取得 uid（token 優先，沒 token 才用 api key） =========
  let uid = null;
  let authMode = "none";

  const token = getBearerToken(event.headers);
  if (token) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
      authMode = "token";
    } catch (e) {
      console.error("verifyIdToken failed:", e);
      return json(401, { ok: false, error: "Invalid token" });
    }
  } else {
    // 保留你原本捷徑模式：X-API-Key
    const apiKey = event.headers["x-api-key"] || event.headers["X-API-Key"];
    if (!process.env.API_KEY || apiKey !== process.env.API_KEY) {
      return json(401, { ok: false, error: "Unauthorized" });
    }
    authMode = "apiKey";

    // ⚠️ API Key 模式下，必須知道要寫到哪個使用者底下
    // 捷徑請加上 uid，否則不知道要寫到 users/{誰}/transactions
    uid = String(data.uid || "").trim();
    if (!uid) {
      return json(400, { ok: false, error: "uid is required when using API key mode" });
    }
  }

  // ========= 3) 驗證欄位 =========
  const amount = Number(data.amount);
  const category = String(data.category || "").trim();
  const note = (data.note == null ? "" : String(data.note)).trim();
  const date = String(data.date || "").trim(); // YYYY-MM-DD
  const time = String(data.time || "").trim(); // HH:MM (optional)
  const type = String(data.type || "expense").trim(); // income/expense (optional)

  // Debug log（保留）
  console.log("httpMethod:", event.httpMethod);
  console.log("content-type:", event.headers["content-type"] || event.headers["Content-Type"]);
  console.log("authMode:", authMode);
  console.log("uid:", uid);
  console.log("raw body:", event.body);
  console.log("parsed data:", data);
  console.log("keys:", Object.keys(data || {}));

  if (!Number.isFinite(amount) || amount <= 0) return json(400, { ok: false, error: "amount must be > 0" });
  if (!category) return json(400, { ok: false, error: "category is required" });
  if (!date) return json(400, { ok: false, error: "date is required" });

  try {
    const db = admin.firestore();

    // ✅ 寫入與前端一致：users/{uid}/transactions
    const ref = await db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .add({
        amount,
        category,
        note,
        date,
        ...(time ? { time } : {}),
        ...(type ? { type } : {}),
        source: authMode === "token" ? "web_function" : "shortcut",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return json(200, { ok: true, id: ref.id, via: authMode });
  } catch (e) {
    console.error(e);
    return json(500, { ok: false, error: "Server error" });
  }
};