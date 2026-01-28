import { NavLink, useNavigate } from "react-router-dom";
import { getUser, logout } from "../auth/auth";

export default function Layout({ title, children }) {
  const navigate = useNavigate();
  const user = getUser();

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const linkStyle = ({ isActive }) => ({
    padding: "8px 10px",
    borderRadius: 10,
    textDecoration: "none",
    border: "1px solid #ddd",
    background: isActive ? "#f3f3f3" : "transparent",
    color: "#111",
    fontWeight: 600,
  });

  return (
    <div>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "white",
          borderBottom: "1px solid #eee",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Kumasci Panel</div>
            <nav style={{ display: "flex", gap: 8 }}>
              <NavLink to="/dashboard" style={linkStyle}>Dashboard</NavLink>
              <NavLink to="/desenler" style={linkStyle}>Desenler</NavLink>
              {user?.role === "superadmin" ? (
                <NavLink to="/superadmin/users" style={linkStyle}>Onay Paneli</NavLink>
              ) : null}
            </nav>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{user?.email || "-"}</div>
              <div style={{ fontSize: 12, color: "#666" }}>role: {user?.role || "-"}</div>
            </div>
            <button
              onClick={onLogout}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Cikis
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        {title ? <h2 style={{ marginTop: 6 }}>{title}</h2> : null}
        {children}
      </main>
    </div>
  );
}
