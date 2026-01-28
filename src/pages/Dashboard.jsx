import Layout from "../components/Layout";
import { getUser } from "../auth/auth";

export default function Dashboard() {
  const user = getUser();

  return (
    <Layout title="Dashboard">
      <p>
        Hos geldin: <b>{user?.email}</b>
      </p>

      <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Bugun</div>
          <div style={{ color: "#555" }}>Desen ekleme, foto yukleme ve arsivleme akisini kuracagiz.</div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Yetki Hazirligi</div>
          <div style={{ color: "#555" }}>
            Role altyapisi hazir: <b>{user?.role}</b>. Sonra staff/viewer ekleyecegiz.
          </div>
        </div>
      </div>
    </Layout>
  );
}
