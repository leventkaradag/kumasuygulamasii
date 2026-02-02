import Layout from "../components/Layout";

export default function Boyahane() {
  return (
    <Layout title="Boyahane">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Kuyruk</div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">Boya Plani</h2>
          <p className="mt-3 text-sm text-neutral-600">
            Boya sirasi ve palet onceliklendirmesi burada yonetilecek.
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Kalite</div>
          <p className="mt-3 text-sm text-neutral-600">
            Prova numuneleri ve revizyonlar icin hizli aksiyon alani.
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Rapor</div>
          <p className="mt-3 text-sm text-neutral-600">
            Gun sonu boya cikislari otomatik rapora baglanacak.
          </p>
        </div>
      </div>
    </Layout>
  );
}
