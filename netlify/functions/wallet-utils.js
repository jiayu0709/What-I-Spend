// wallet-utils.js
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function normalizeCurrency(v) {
  return String(v || "TWD").trim().toUpperCase();
}

export function getAllowedCurrenciesFromBookData(bookData = {}) {
  const list = ["TWD"];
  const foreign = normalizeCurrency(bookData?.settings?.foreignCurrency || "");

  if (foreign && foreign !== "TWD") {
    list.push(foreign);
  }

  return list;
}

export async function getBookData(db, uid, bookId) {
  if (!uid || !bookId) return {};
  const ref = doc(db, "users", uid, "books", bookId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() || {}) : {};
}

export async function getWalletsByBookId(db, uid, bookId) {
  if (!uid || !bookId) return [];

  const ref = collection(db, "users", uid, "books", bookId, "wallets");
  const q = query(
    ref,
    where("archived", "==", false),
    orderBy("createdAt", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getCurrentBookWallets(db, uid) {
  const bookId = localStorage.getItem("wis_currentBookId") || "";
  if (!bookId) return [];
  return getWalletsByBookId(db, uid, bookId);
}

export async function ensureDefaultWallet(db, uid, bookId) {
  if (!uid || !bookId) return;

  const existing = await getWalletsByBookId(db, uid, bookId);
  if (existing.length > 0) return;

  await addDoc(
    collection(db, "users", uid, "books", bookId, "wallets"),
    {
      name: "現金",
      currency: "TWD",
      openingBalance: 0,
      archived: false,
      createdAt: serverTimestamp(),
    }
  );
}

export function filterWalletsByCurrency(wallets = [], currency = "TWD") {
  const cur = normalizeCurrency(currency);
  return wallets.filter(w => normalizeCurrency(w.currency) === cur);
}

export function renderWalletOptions(selectEl, wallets = [], selectedWalletId = "") {
  if (!selectEl) return;

  selectEl.innerHTML = "";

  for (const wallet of wallets) {
    const opt = document.createElement("option");
    opt.value = wallet.id;
    opt.textContent = wallet.name || "未命名錢包";
    selectEl.appendChild(opt);
  }

  const selected = String(selectedWalletId || "").trim();

  if (selected && wallets.some(w => w.id === selected)) {
    selectEl.value = selected;
  } else if (wallets.length > 0) {
    selectEl.value = wallets[0].id;
  }
}

export function getWalletById(wallets = [], walletId = "") {
  return wallets.find(w => w.id === walletId) || null;
}