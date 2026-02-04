// netlify/functions/addTransaction.js
import admin from "firebase-admin";

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      // ✅ 讓 Authorization / Shortcut Token / API Key 都能過
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-API-Key, X-Shortcut-Token",
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

function getShortcutToken(headers = {}, body = {}) {
  // ✅ 1) header 優先（最乾淨）
  const h =
    headers["x-shortcut-token"] ||
    headers["X-Shortcut-Token"] ||
    headers["x-shortcuttoken"] ||
    headers["X-ShortcutToken"];

  if (h) return String(h).trim();

  // ✅ 2) body 也支援（捷徑 Get Contents of URL 很常這樣送）
  const b = body.shortcutToken || body.token || body.shortcut_token;
  return b ? String(b).trim() : "";
}

function normalizeBody(data) {
  // ✅ 防呆：把 key 前後空白去掉（避免 category␠ 這種）
  const cleaned = {};
  for (const [k, v] of Object.entries(data || {})) cleaned[String(k).trim()] = v;
  return cleaned;
}

function isValidDateYYYYMMDD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}
function isValidTimeHHMM(s) {
  return /^\d{2}:\d{2}$/.test(String(s || "").trim());
}

async function uidFromShortcutToken(db, shortcutToken) {
  // users/{uid} 內有 shortcutToken 欄位
  const snap = await db
    .collection("users")
    .where("shortcutToken", "==", shortcutToken)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].id;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST")
    return json(405, { ok: false, error: "Method Not Allowed" });

  try {
    initAdmin();
  } catch (e) {
    console.error("initAdmin failed:", e);
    return json(500, { ok: false, error: "Admin init failed" });
  }

  // ========= 1) 解析 JSON =========
  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }
  data = normalizeBody(data);

  const db = admin.firestore();

  // ========= 2) 決定 uid（支援三種模式） =========
  let uid = null;
  let authMode = "none";

  // (A) ✅ Web / PWA：Firebase ID Token
  const bearer = getBearerToken(event.headers);
  if (bearer) {
    try {
      const decoded = await admin.auth().verifyIdToken(bearer);
      uid = decoded.uid;
      authMode = "idToken";
    } catch (e) {
      console.error("verifyIdToken failed:", e);
      return json(401, { ok: false, error: "Invalid ID token" });
    }
  }

  // (B) ✅ Shortcut Token：用 token 找到 uid
  if (!uid) {
    const shortcutToken = getShortcutToken(event.headers, data);
    if (shortcutToken) {
      try {
        uid = await uidFromShortcutToken(db, shortcutToken);
        if (!uid) {
          return json(401, {
            ok: false,
            error: "Invalid shortcutToken (no matched user)",
          });
        }
        authMode = "shortcutToken";
      } catch (e) {
        console.error("uidFromShortcutToken failed:", e);
        return json(500, { ok: false, error: "Lookup shortcutToken failed" });
      }
    }
  }

  // (C) ♻️ 可選：保留舊版 API_KEY + uid（相容你舊捷徑）
  // 如果你確定以後都用 shortcutToken，這段可以整段刪掉。
  if (!uid) {
    const apiKey = event.headers["x-api-key"] || event.headers["X-API-Key"];
    if (apiKey) {
      if (!process.env.API_KEY || apiKey !== process.env.API_KEY) {
        return json(401, { ok: false, error: "Unauthorized (API key)" });
      }
      uid = String(data.uid || "").trim();
      if (!uid) {
        return json(400, {
          ok: false,
          error: "uid is required when using API key mode",
        });
      }
      authMode = "apiKey_uid";
    }
  }

  if (!uid) {
    return json(401, {
      ok: false,
      error:
        "Unauthorized: provide Authorization Bearer <ID token> OR shortcutToken (header/body) OR X-API-Key+uid",
    });
  }

  // ========= 3) 驗證欄位 =========
  const amount = Number(data.amount);
  const category = String(data.category || "").trim();
  const note = (data.note == null ? "" : String(data.note)).trim();
  const date = String(data.date || "").trim(); // YYYY-MM-DD
  const time = String(data.time || "").trim(); // HH:MM (optional)
  const type = String(data.type || "expense").trim(); // income/expense

  // Debug（保留，方便你查）
  console.log("authMode:", authMode);
  console.log("uid:", uid);
  console.log("keys:", Object.keys(data || {}));

  if (!Number.isFinite(amount) || amount <= 0)
    return json(400, { ok: false, error: "amount must be > 0" });

  if (!category) return json(400, { ok: false, error: "category is required" });

  if (!isValidDateYYYYMMDD(date))
    return json(400, { ok: false, error: "date must be YYYY-MM-DD" });

  if (time && !isValidTimeHHMM(time))
    return json(400, { ok: false, error: "time must be HH:MM" });

  if (type !== "income" && type !== "expense")
    return json(400, { ok: false, error: "type must be income|expense" });

  // ========= 4) 寫入 Firestore =========
  try {
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
        type,
        source:
          authMode === "idToken"
            ? "web_function"
            : authMode === "shortcutToken"
            ? "shortcut_token"
            : "shortcut_apikey",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return json(200, { ok: true, id: ref.id, via: authMode });
  } catch (e) {
    console.error("firestore add failed:", e);
    return json(500, { ok: false, error: "Server error" });
  }
};