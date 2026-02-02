const KEY_SESSION = "kumasci_auth";
const KEY_DB = "kumasci_users_db";

function encode(s) {
  try { return btoa(unescape(encodeURIComponent(String(s)))); }
  catch { return String(s); }
}
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function readDb() {
  const raw = localStorage.getItem(KEY_DB);
  return raw ? JSON.parse(raw) : [];
}
function writeDb(db) {
  localStorage.setItem(KEY_DB, JSON.stringify(db));
}

export function seedSuperAdmin({ email = "admin@kumasci.local", password = "admin1234" } = {}) {
  const e = normalizeEmail(email);
  const db = readDb();

  const hasSuper = db.some((u) => u.role === "superadmin" && u.status === "active");
  if (hasSuper) return;

  const exists = db.some((u) => u.email === e);
  if (!exists) {
    db.push({
      email: e,
      pass: encode(password),
      role: "superadmin",
      status: "active",
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    });
  } else {
    const idx = db.findIndex((u) => u.email === e);
    db[idx] = { ...db[idx], role: "superadmin", status: "active", approvedAt: new Date().toISOString() };
  }
  writeDb(db);
}

export function register(email, password) {
  const e = normalizeEmail(email);
  if (!e || !password) throw new Error("Email ve sifre gerekli.");

  const db = readDb();
  if (db.some((u) => u.email === e)) throw new Error("Bu email ile zaten hesap var.");

  db.push({
    email: e,
    pass: encode(password),
    role: "pending",
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  return true;
}

export function login(email, password) {
  seedSuperAdmin();
  const e = normalizeEmail(email);
  if (!e || !password) throw new Error("Email ve sifre gerekli.");

  const db = readDb();
  const found = db.find((u) => u.email === e);
  if (!found) throw new Error("Hesap bulunamadi. Once kayit ol.");
  if (found.pass !== encode(password)) throw new Error("Sifre hatali.");

  if (found.status !== "active") {
    if (found.status === "pending") throw new Error("Hesabin onay bekliyor. SuperAdmin onaylamali.");
    if (found.status === "denied") throw new Error("Hesabin reddedildi. SuperAdmin ile iletisime gec.");
    throw new Error("Hesap durumu gecersiz.");
  }

  const user = { email: e, role: found.role || "viewer", loggedInAt: new Date().toISOString() };
  localStorage.setItem(KEY_SESSION, JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem(KEY_SESSION);
}
export function getUser() {
  const raw = localStorage.getItem(KEY_SESSION);
  return raw ? JSON.parse(raw) : null;
}
export function isAuthed() {
  return !!getUser();
}

export function getUsersDb() {
  seedSuperAdmin();
  return readDb();
}
export function approveUser(email, role) {
  const e = normalizeEmail(email);
  const db = readDb();
  const idx = db.findIndex((u) => u.email === e);
  if (idx === -1) throw new Error("Kullanici bulunamadi.");

  db[idx] = { ...db[idx], role, status: "active", approvedAt: new Date().toISOString() };
  writeDb(db);
}
export function denyUser(email) {
  const e = normalizeEmail(email);
  const db = readDb();
  const idx = db.findIndex((u) => u.email === e);
  if (idx === -1) throw new Error("Kullanici bulunamadi.");

  db[idx] = { ...db[idx], status: "denied", deniedAt: new Date().toISOString() };
  writeDb(db);
}
export function deleteUser(email) {
  const e = normalizeEmail(email);
  const db = readDb().filter((u) => u.email !== e);
  writeDb(db);
}
