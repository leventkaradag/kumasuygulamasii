import { useState } from "react";
import { Link } from "react-router-dom";
import { register } from "../auth/auth";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setErr("");

    if (password.length < 4) return setErr("Sifre en az 4 karakter olsun (demo).");
    if (password !== password2) return setErr("Sifreler ayni degil.");

    try {
      register(email, password);
      setDone(true);
    } catch (e2) {
      setErr(e2?.message || "Kayit basarisiz.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #ddd", borderRadius: 12, padding: 20 }}>
        <h1 style={{ margin: 0, marginBottom: 6 }}>Hesap Olustur</h1>
        <p style={{ marginTop: 0, color: "#555" }}>Kayit sonrasi SuperAdmin onayi gerekir.</p>

        {!done ? (
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

            <label style={{ display: "grid", gap: 6 }}>
              <span>Sifre Tekrar</span>
              <input value={password2} onChange={(e) => setPassword2(e.target.value)} type="password"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
            </label>

            {err ? <div style={{ color: "crimson", fontSize: 14 }}>{err}</div> : null}

            <button type="submit" style={{ padding: 12, borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700 }}>
              Kayit Ol
            </button>
          </form>
        ) : (
          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Kaydin alindi ✅</div>
            <div style={{ color: "#555" }}>
              Hesabin su an <b>ONAY BEKLIYOR</b>. SuperAdmin onayladiktan sonra giris yapabilirsin.
            </div>
            <div style={{ marginTop: 10 }}>
              <Link to="/login">Giris ekranina don</Link>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 13 }}>
          Zaten hesabın var mı? <Link to="/login">Giris yap</Link>
        </div>
      </div>
    </div>
  );
}
