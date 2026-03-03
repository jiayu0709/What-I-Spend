// netlify/functions/getCategories.js
import admin from "firebase-admin";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function initAdmin() {
  if (admin.apps.length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");

  const sa = JSON.parse(raw);
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const { shortcutToken, bookId } = body;
  if (!shortcutToken) return json(400, { ok: false, error: "Missing shortcutToken" });
  if (!bookId) return json(400, { ok: false, error: "Missing bookId" });

  try {
    initAdmin();
    const db = admin.firestore();

    // 1) 用 shortcutToken 找 uid
    const userSnap = await db
      .collection("users")
      .where("shortcutToken", "==", shortcutToken)
      .limit(1)
      .get();

    if (userSnap.empty) return json(401, { ok: false, error: "Invalid shortcut token" });

    const uid = userSnap.docs[0].id;

    // 2) 讀書本 categories
    const bookRef = db.collection("users").doc(uid).collection("books").doc(bookId);
    const bookSnap = await bookRef.get();

    if (!bookSnap.exists) return json(404, { ok: false, error: "Book not found" });

    const data = bookSnap.data() || {};
    const c = data.categories || {};

    const categories = {
      expense: Array.isArray(c.expense) ? c.expense : [],
      income: Array.isArray(c.income) ? c.income : [],
    };

    return json(200, { ok: true, bookId, categories });
  } catch (e) {
    console.error(e);
    return json(500, { ok: false, error: "Server error" });
  }
};