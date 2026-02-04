// netlify/functions/addTransaction.js
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

  const { date, time, type, amount, category, note, shortcutToken } = body;

  if (!date || !category || !amount) {
    return json(400, { ok: false, error: "Missing fields" });
  }

  try {
    initAdmin();
    const db = admin.firestore();

    let uid = null;

    /* ===============================
       A️⃣ Web / PWA：Firebase ID Token
       =============================== */
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.slice(7);
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
    }

    /* ==================================
       B️⃣ Shortcut：shortcutToken
       ================================== */
    if (!uid && shortcutToken) {
      const snap = await db
        .collection("users")
        .where("shortcutToken", "==", shortcutToken)
        .limit(1)
        .get();

      if (snap.empty) {
        return json(401, { ok: false, error: "Invalid shortcut token" });
      }
      uid = snap.docs[0].id;
    }

    if (!uid) {
      return json(401, { ok: false, error: "Unauthorized" });
    }

    await db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .add({
        date,
        time: time || "",
        type: type || "expense",
        amount,
        category,
        note: note || "",
        source: shortcutToken ? "shortcut" : "web",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(500, { ok: false, error: "Server error" });
  }
};