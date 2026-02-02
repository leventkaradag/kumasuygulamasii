import Layout from "../components/Layout";

export default function Ayarlar() {
  return (
    <Layout title="Ayarlar">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Profil</div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">Kullanici Ayarlari</h2>
          <p className="mt-3 text-sm text-neutral-600">
            Bildirimler, tema ve hesap detaylari burada yonetilecek.
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Guvenlik</div>
          <p className="mt-3 text-sm text-neutral-600">
            Yetki seviyeleri ve erisim politikasi ayarlari icin hazir alan.
          </p>
        </div>
      </div>
    </Layout>
  );
}
