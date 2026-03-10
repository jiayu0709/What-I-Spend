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

function normalizeCurrency(v) {
  return String(v || "TWD").trim().toUpperCase();
}

function toNumber(v) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function buildAllowedCurrencies(settings = {}) {
  const list = ["TWD"];
  const foreign = normalizeCurrency(settings.foreignCurrency || "");

  if (foreign && foreign !== "TWD" && ["USD", "EUR"].includes(foreign)) {
    list.push(foreign);
  }

  return list;
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

  const shortcutToken = String(body.shortcutToken || "").trim();
  const bookId = String(body.bookId || "").trim();
  const date = String(body.date || "").trim();
  const time = String(body.time || "").trim();
  const rawType = String(body.type || "expense").trim();
  const type = rawType === "income" ? "income" : "expense";
  const category = String(body.category || "").trim();
  const note = String(body.note || "").trim();

  const amount = toNumber(body.amount);
  const inputCurrency = normalizeCurrency(body.currency || "TWD");
  const inputFxRateToTWD = toNumber(body.fxRateToTWD);

  if (!date || !category || !Number.isFinite(amount) || amount <= 0) {
    return json(400, {
      ok: false,
      error: "Missing fields",
      detail: {
        date,
        category,
        amount: body.amount,
      },
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

    // 若沒傳 bookId，就抓第一本未封存帳本
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

    if (!finalBookId) {
      return json(400, { ok: false, error: "No available bookId" });
    }

    // 讀帳本設定，限制可用幣別
    const bookRef = db.collection("users").doc(uid).collection("books").doc(finalBookId);
    const bookSnap = await bookRef.get();
    const bookData = bookSnap.exists ? (bookSnap.data() || {}) : {};
    const settings = bookData.settings || {};
    const allowedCurrencies = buildAllowedCurrencies(settings);

    if (!allowedCurrencies.includes(inputCurrency)) {
      return json(400, {
        ok: false,
        error: "Currency not allowed for this book",
        detail: {
          currency: inputCurrency,
          allowedCurrencies,
        },
      });
    }

    let currency = inputCurrency;
    let fxRateToTWD = 1;
    let amountTWD = amount;

    if (currency === "TWD") {
      fxRateToTWD = 1;
      amountTWD = amount;
    } else {
      if (!Number.isFinite(inputFxRateToTWD) || inputFxRateToTWD <= 0) {
        return json(400, {
          ok: false,
          error: "Invalid fxRateToTWD",
          detail: {
            currency,
            fxRateToTWD: body.fxRateToTWD,
          },
        });
      }

      fxRateToTWD = inputFxRateToTWD;
      amountTWD = amount * fxRateToTWD;
    }

    const docRef = await db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .add({
        bookId: finalBookId,
        date,
        time,
        type,
        amount,
        category,
        note,
        currency,
        fxRateToTWD,
        amountTWD,
        source: shortcutToken ? "shortcut" : "web",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return json(200, {
      ok: true,
      id: docRef.id,
      bookId: finalBookId,
      currency,
      fxRateToTWD,
      amountTWD,
    });
  } catch (e) {
    console.error(e);
    return json(500, {
      ok: false,
      error: "Server error",
      detail: e?.message || String(e),
    });
  }
};