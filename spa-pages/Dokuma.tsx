import Layout from "../components/Layout";

export default function Dokuma() {
  return (
    <Layout title="Dokuma">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Tezgahlar</div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">Uretim Takibi</h2>
          <p className="mt-3 text-sm text-neutral-600">
            Tezgah doluluk ve vardiya planlamasi icin hizli gorunum.
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Verim</div>
          <p className="mt-3 text-sm text-neutral-600">
            Fire oranlari ve cikis trendleri buradan izlenecek.
          </p>
        </div>
      </div>
    </Layout>
  );
}
