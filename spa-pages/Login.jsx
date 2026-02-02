"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "../auth/auth";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    setErr("");
    try {
      login(email, password);
      router.replace("/dashboard");
    } catch (e2) {
      setErr(e2?.message || "Giris basarisiz.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #ddd", borderRadius: 12, padding: 20 }}>
        <h1 style={{ margin: 0, marginBottom: 6 }}>Kumasci Panel</h1>
        <p style={{ marginTop: 0, color: "#555" }}>Giris icin hesabinin onayli olmasi gerekir.</p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Sifre</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          </label>

          {err ? <div style={{ color: "crimson", fontSize: 14 }}>{err}</div> : null}

          <button type="submit" style={{ padding: 12, borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700 }}>
            Giris Yap
          </button>
        </form>

        <div style={{ marginTop: 12, fontSize: 13 }}>
          Hesabin yok mu? <Link href="/register">Hesap ac</Link>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
          Demo SuperAdmin: <b>admin@kumasci.local</b> / <b>admin1234</b>
        </div>
      </div>
    </div>
  );
}
