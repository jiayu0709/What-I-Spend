import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
}

const db = getFirestore();

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase(); // 6碼
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // ✅ 需要 Firebase ID Token
    const authHeader = event.headers.authorization || "";
    const m = authHeader.match(/^Bearer (.+)$/);
    if (!m) return { statusCode: 401, body: "Missing Authorization" };

    const idToken = m[1];
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const code = genCode();
    await db.collection("setupCodes").doc(code).set({
      uid,
      used: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: FieldValue.serverTimestamp(), // 用 createdAt 算 10 分鐘
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ code }),
    };
  } catch (e) {
    return { statusCode: 500, body: e.message || String(e) };
  }
}