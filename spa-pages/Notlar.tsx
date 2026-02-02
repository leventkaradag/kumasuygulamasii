import Layout from "../components/Layout";

export default function NotlarPage() {
  return (
    <Layout title="Notlar">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Not Defteri</h2>
          <p className="text-sm text-neutral-600">
            Kisa notlar ve hatirlatmalar icin placeholder sayfa.
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="text-sm text-neutral-600">
            Not Defteri modulu yakinda eklenecek. Simdilik bu alan placeholder olarak
            duruyor.
          </div>
        </div>
      </div>
    </Layout>
  );
}
