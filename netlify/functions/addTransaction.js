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

// ✅ 新增：確保有預設帳本，並回傳 bookId
async function ensureDefaultBookId(db, uid) {
  const booksRef = db.collection("users").doc(uid).collection("books");

  // 1) 找未封存、最早建立的帳本當預設
  const snap = await booksRef
    .where("archived", "==", false)
    .orderBy("createdAt", "asc")
    .limit(1)
    .get();

  if (!snap.empty) return snap.docs[0].id;

  // 2) 沒有就建立「生活」
  const docRef = await booksRef.add({
    name: "生活",
    archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return docRef.id;
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

  // ✅ 加入 bookId（可選）
  const { date, time, type, amount, category, note, shortcutToken, bookId: inputBookId } = body;

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

    // ✅ 核心修正：確保一定有 bookId
    // - 如果 body 有帶 bookId 就用
    // - 沒帶就自動抓「預設帳本」，沒有則建立「生活」
    const bookId = (typeof inputBookId === "string" ? inputBookId.trim() : "") || (await ensureDefaultBookId(db, uid));

    await db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .add({
        bookId, // ✅ 新增
        date,
        time: time || "",
        type: type || "expense",
        amount,
        category,
        note: note || "",
        source: shortcutToken ? "shortcut" : "web",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return json(200, { ok: true, bookId }); // ✅ 回傳 bookId 方便你 debug
  } catch (e) {
    console.error(e);
    return json(500, { ok: false, error: "Server error" });
  }
};