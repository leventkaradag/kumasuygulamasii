"use client";

import { useEffect, useState } from "react";
import { settingsSupabaseRepo } from "@/lib/repos/settingsSupabaseRepo";

export function AdminSettingsPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    settingsSupabaseRepo
      .isDyehouseToDepotEnabled()
      .then(setEnabled)
      .catch(() => setEnabled(true));
  }, []);

  const toggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setError("");
    try {
      await settingsSupabaseRepo.setDyehouseToDepotEnabled(next);
      setEnabled(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ayar guncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (enabled === null) {
    return (
      <section className="mt-6 overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
        <div className="px-6 py-8 text-center text-sm text-neutral-500">
          Sistem ayarlari yukleniyor...
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
      <div className="border-b border-black/5 px-6 py-4">
        <div className="text-lg font-semibold text-neutral-900">
          Sistem Ayarlari
        </div>
        <div className="mt-1 text-sm text-neutral-500">
          Sistemin genel isleyisini buradan yonetebilirsiniz. Degisiklikler aninda tum cihazlarda gecerli olur.
        </div>
      </div>
      <div className="px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-neutral-900">Boyahane → Depo Akisi</div>
            <p className="mt-1 text-sm text-neutral-600">
              Bu ayari pasife aldiginizda, boyahanede is bitirildikten sonra Depo Cikis Belgesi olusturulmasi fiziksel olarak engellenir. Degisiklik tum kullanicilar ve cihazlar icin aninda gecerli olur.
            </p>
          </div>
          <button
            onClick={toggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-wait disabled:opacity-60 ${
              enabled ? "bg-emerald-500" : "bg-neutral-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          {enabled ? (
            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              Durum: Aktif (Acik)
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-rose-500/30 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
              Durum: Pasif (Kapali)
            </span>
          )}
          {saving ? (
            <span className="text-xs text-neutral-500">Kaydediliyor...</span>
          ) : null}
        </div>
        {error ? (
          <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
