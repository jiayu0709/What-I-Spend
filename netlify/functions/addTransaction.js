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

  // ✅ 重要：token trim + amount 轉數字
  const shortcutToken = String(body.shortcutToken || "").trim();
  const bookId = String(body.bookId || "").trim();
  const date = String(body.date || "").trim();
  const time = String(body.time || "").trim();
  const type = String(body.type || "expense").trim();
  const category = String(body.category || "").trim();
  const note = String(body.note || "").trim();

  const amountNum = Number(String(body.amount ?? "").replace(/,/g, ""));
  const amount = Number.isFinite(amountNum) ? amountNum : NaN;

  if (!date || !category || !Number.isFinite(amount) || amount <= 0) {
    return json(400, {
      ok: false,
      error: "Missing fields",
      detail: { date, category, amount: body.amount },
    });
  }

  try {
    initAdmin();
    const db = admin.firestore();

    let uid = null;

    // A) Web / PWA：Firebase ID Token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.slice(7);
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
    }

    // B) Shortcut：shortcutToken
    if (!uid) {
      if (!shortcutToken) {
        return json(401, { ok: false, error: "Unauthorized (missing shortcutToken)" });
      }

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

    // ✅ 如果捷徑沒傳 bookId，就給它用預設第一本（避免你忘了接）
    let finalBookId = bookId;
    if (!finalBookId) {
      const booksSnap = await db
        .collection("users")
        .doc(uid)
        .collection("books")
        .where("archived", "==", false)
        .orderBy("createdAt", "asc")
        .limit(1)
        .get();

      if (!booksSnap.empty) {
        finalBookId = booksSnap.docs[0].id;
      }
    }

    const docRef = await db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .add({
        bookId: finalBookId || "", // ✅ 寫入 bookId（可能是空字串但至少不會漏）
        date,
        time,
        type,
        amount,
        category,
        note,
        source: shortcutToken ? "shortcut" : "web",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return json(200, { ok: true, id: docRef.id, bookId: finalBookId || "" });
  } catch (e) {
    console.error(e);
    return json(500, { ok: false, error: "Server error" });
  }
};