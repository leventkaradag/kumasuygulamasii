"use client";

import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { approveUser, denyUser, deleteUser, getUsersDb } from "../auth/auth";

export default function SuperAdminUsers() {
  const [refresh, setRefresh] = useState(0);
  const [rolePick, setRolePick] = useState({}); // email -> role
  const [db, setDb] = useState([]);

  useEffect(() => {
    setDb(getUsersDb());
  }, [refresh]);

  const pending = db.filter((u) => u.status === "pending");
  const active = db.filter((u) => u.status === "active");
  const denied = db.filter((u) => u.status === "denied");

  const doApprove = (email) => {
    const role = rolePick[email] || "viewer";
    approveUser(email, role);
    setRefresh((x) => x + 1);
  };

  const doDeny = (email) => {
    denyUser(email);
    setRefresh((x) => x + 1);
  };

  const doDelete = (email) => {
    deleteUser(email);
    setRefresh((x) => x + 1);
  };

  const RoleSelect = ({ email, disabled }) => (
    <select
      disabled={disabled}
      value={rolePick[email] || "viewer"}
      onChange={(e) => setRolePick((prev) => ({ ...prev, [email]: e.target.value }))}
      style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
    >
      <option value="viewer">viewer</option>
      <option value="staff">staff</option>
      <option value="admin">admin</option>
      <option value="superadmin">superadmin</option>
    </select>
  );

  const Row = ({ u, mode }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 140px 110px 110px 110px",
        gap: 10,
        alignItems: "center",
        padding: 10,
        border: "1px solid #eee",
        borderRadius: 12,
      }}
    >
      <div>
        <div style={{ fontWeight: 800 }}>{u.email}</div>
        <div style={{ fontSize: 12, color: "#666" }}>
          status: <b>{u.status}</b> - role: <b>{u.role}</b>
        </div>
      </div>

      <RoleSelect email={u.email} disabled={mode !== "pending"} />

      {mode === "pending" ? (
        <>
          <button
            onClick={() => doApprove(u.email)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", cursor: "pointer", fontWeight: 700 }}
          >
            Onayla
          </button>
          <button
            onClick={() => doDeny(u.email)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
          >
            Reddet
          </button>
          <button
            onClick={() => doDelete(u.email)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
          >
            Sil
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#666" }} />
          <div style={{ fontSize: 12, color: "#666" }} />
          <button
            onClick={() => doDelete(u.email)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
          >
            Sil
          </button>
        </>
      )}
    </div>
  );

  return (
    <Layout title="SuperAdmin - Kullanici Onay Paneli">
      <div style={{ maxWidth: 980 }}>
        <div style={{ marginBottom: 12, color: "#555" }}>
          Register olanlar <b>pending</b> gelir. Onaylayinca <b>active</b> olur ve login yapabilir.
        </div>

        <h3 style={{ marginBottom: 8 }}>Bekleyenler ({pending.length})</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {pending.length ? pending.map((u) => <Row key={u.email} u={u} mode="pending" />) : <div style={{ color: "#777" }}>Bekleyen yok.</div>}
        </div>

        <h3 style={{ margin: "18px 0 8px" }}>Aktif ({active.length})</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {active.length ? active.map((u) => <Row key={u.email} u={u} mode="active" />) : <div style={{ color: "#777" }}>Aktif yok.</div>}
        </div>

        <h3 style={{ margin: "18px 0 8px" }}>Reddedilen ({denied.length})</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {denied.length ? denied.map((u) => <Row key={u.email} u={u} mode="denied" />) : <div style={{ color: "#777" }}>Reddedilen yok.</div>}
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "#777" }}>
          Not: Demo icin SuperAdmin seed hesap: <b>admin@kumasci.local</b> / <b>admin1234</b>
        </div>
      </div>
    </Layout>
  );
}
