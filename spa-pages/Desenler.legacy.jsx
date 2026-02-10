import Layout from "../components/Layout";

export default function Desenler() {
  return (
    <Layout title="Desenler">
      <p>Buraya desen kartlarini birazdan koyuyoruz.</p>

      <div style={{ border: "1px dashed #bbb", borderRadius: 12, padding: 16, marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Sonraki adim</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#444" }}>
          <li>Desen kart component</li>
          <li>Dijital + Islem Sonrasi foto alanlari</li>
          <li>Yeni desen ekleme formu</li>
          <li>LocalStorage data modeli (sonra Supabase)</li>
        </ol>
      </div>
    </Layout>
  );
}
