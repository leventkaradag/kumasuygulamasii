import Layout from "../components/Layout";

export default function Raporlar() {
  return (
    <Layout title="Raporlar">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Gunluk</div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">Uretim Raporu</h2>
          <p className="mt-3 text-sm text-neutral-600">
            Gunluk cikis, fire ve sevkiyat raporlari.
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Haftalik</div>
          <p className="mt-3 text-sm text-neutral-600">
            Haftalik desen performanslari ve stok hareketleri.
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Paylasim</div>
          <p className="mt-3 text-sm text-neutral-600">
            PDF ve Excel ciktilari icin paylasim merkezi.
          </p>
        </div>
      </div>
    </Layout>
  );
}
