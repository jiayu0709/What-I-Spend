// netlify/functions/getBooks.js
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
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method Not Allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const { shortcutToken } = body;
  if (!shortcutToken) {
    return json(400, { ok: false, error: "Missing shortcutToken" });
  }

  try {
    initAdmin();
    const db = admin.firestore();

    // 用 shortcutToken 找 uid
    const userSnap = await db
      .collection("users")
      .where("shortcutToken", "==", shortcutToken)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return json(401, { ok: false, error: "Invalid shortcut token" });
    }

    const uid = userSnap.docs[0].id;

    // 取 books（未封存）
    const booksSnap = await db
      .collection("users")
      .doc(uid)
      .collection("books")
      .where("archived", "==", false)
      .orderBy("createdAt", "asc")
      .get();

    const books = booksSnap.docs.map((d) => {
      const data = d.data() || {};
      return { id: d.id, name: data.name || "未命名帳本" };
    });

    return json(200, { ok: true, books });
  } catch (e) {
    console.error(e);
    return json(500, { ok: false, error: "Server error" });
  }
};