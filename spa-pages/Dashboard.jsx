"use client";

import Layout from "../components/Layout";
import { getUser } from "../auth/auth";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Hos geldin</div>
            <div className="text-lg font-semibold text-neutral-900">
              {user?.email || "Misafir"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5">
              Yeni Desen
            </button>
            <button className="rounded-full bg-coffee-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5">
              Rapor Olustur
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Bugun</div>
            <div className="mt-2 text-lg font-semibold text-neutral-900">
              Desen ekleme, foto yukleme ve arsivleme akisi
            </div>
            <p className="mt-3 text-sm text-neutral-600">
              Dijital ve final gorselleri ayni panelden ilerleyecek.
            </p>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Yetki Hazirligi</div>
            <div className="mt-2 text-lg font-semibold text-neutral-900">
              Rol altyapisi hazir
            </div>
            <p className="mt-3 text-sm text-neutral-600">
              Aktif rol: <b>{user?.role || "viewer"}</b>. Sonraki adim staff/viewer
              eklemek.
            </p>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Hedef</div>
            <div className="mt-2 text-lg font-semibold text-neutral-900">
              Operasyon ekranlarini tek akista birlestir
            </div>
            <p className="mt-3 text-sm text-neutral-600">
              Depo, dokuma ve boyahane modulleri bu sayfaya baglanacak.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
