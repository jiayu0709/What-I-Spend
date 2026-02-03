// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDkj60hCKagiQijipxl3s6F5soN1YIKadE",
  authDomain: "whatispend.netlify.app",
  projectId: "whatispend-3c060",
  storageBucket: "whatispend-3c060.firebasestorage.app",
  messagingSenderId: "740100624448",
  appId: "1:740100624448:web:88c3298185bd163fba8fa5",
  measurementId: "G-X5V7G8QBCY"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);