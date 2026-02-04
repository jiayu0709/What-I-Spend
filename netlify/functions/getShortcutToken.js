import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
}

const db = getFirestore();

function newToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { setupCode } = JSON.parse(event.body || "{}");
    if (!setupCode) return { statusCode: 400, body: "Missing setupCode" };

    const ref = db.collection("setupCodes").doc(setupCode);
    const snap = await ref.get();
    if (!snap.exists) return { statusCode: 401, body: "Invalid code" };

    const data = snap.data();
    if (data.used) return { statusCode: 401, body: "Code already used" };

    // 10分鐘有效：用 createdAt/ expiresAt 這裡用 createdAt 來算
    const createdAt = data.createdAt?.toMillis?.();
    if (!createdAt) return { statusCode: 401, body: "Code invalid (no createdAt)" };

    const expires = createdAt + 10 * 60 * 1000;
    if (Date.now() > expires) return { statusCode: 401, body: "Code expired" };

    const uid = data.uid;
    const token = newToken();

    // 存 users/{uid}
    await db.collection("users").doc(uid).set({
      shortcutToken: token,
      shortcutTokenCreatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 標記 code 用過
    await ref.update({
      used: true,
      usedAt: FieldValue.serverTimestamp(),
    });

    return { statusCode: 200, body: JSON.stringify({ token }) };
  } catch (e) {
    return { statusCode: 500, body: e.message || String(e) };
  }
}