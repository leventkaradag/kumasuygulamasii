import Layout from "../components/Layout";

export default function Depo() {
  return (
    <Layout title="Depo">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Stok Ozeti</div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">Depo Paneli</h2>
          <p className="mt-3 text-sm text-neutral-600">
            Top, iplik ve ham kumas akislarini buradan takip edecegiz.
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Gorevler</div>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            <li className="flex items-center justify-between">
              <span>Gunluk giris listesi</span>
              <span className="rounded-full bg-coffee-primary/15 px-3 py-1 text-xs font-semibold text-neutral-700">
                Hazirlaniyor
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span>Stok alarmi</span>
              <span className="rounded-full bg-coffee-primary/15 px-3 py-1 text-xs font-semibold text-neutral-700">
                Taslak
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
