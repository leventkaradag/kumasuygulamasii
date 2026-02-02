import Layout from "../components/Layout";

export default function SiparisPage() {
  return (
    <Layout title="Siparisler">
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <div className="rounded-full border border-black/5 bg-coffee-primary/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-700">
          Hazirlaniyor
        </div>
        <h2 className="font-display text-2xl font-semibold text-neutral-900">Siparis Sayfasi</h2>
        <p className="max-w-md text-sm text-neutral-600">
          Siparis girisleri ve takip akisi icin yeni ekran tasarimi burada konumlanacak.
        </p>
      </div>
    </Layout>
  );
}
