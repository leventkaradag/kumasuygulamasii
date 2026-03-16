import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getProfileByUserId,
  getProfileDisplayName,
  isApprovedProfile,
  isSuperadminProfile,
  normalizeProfileRole,
} from "@/lib/supabase/profile-access";
import { createClient } from "@/lib/supabase/server";

const ROLE_OPTIONS = ["user", "admin", "superadmin"] as const;

type PendingProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  status: string | null;
  created_at: string | null;
};

async function requireSuperadminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileByUserId(supabase, user.id);

  if (!profile || !isApprovedProfile(profile.status)) {
    redirect("/pending");
  }

  if (!isSuperadminProfile(profile)) {
    redirect("/dashboard");
  }

  return { supabase, profile };
}

async function updatePendingProfileAction(formData: FormData) {
  "use server";

  const { supabase } = await requireSuperadminAccess();

  const profileId = String(formData.get("profileId") ?? "").trim();
  const nextStatus = String(formData.get("nextStatus") ?? "").trim();
  const nextRole = normalizeProfileRole(String(formData.get("role") ?? "user"));

  if (!profileId) {
    return;
  }

  if (nextStatus !== "approved" && nextStatus !== "rejected") {
    return;
  }

  if (!ROLE_OPTIONS.includes(nextRole as (typeof ROLE_OPTIONS)[number])) {
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      role: nextRole,
      status: nextStatus,
    })
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/onay-paneli");
}

function formatCreatedAt(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ApprovalPanelPage() {
  const { supabase, profile } = await requireSuperadminAccess();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const pendingProfiles = (data ?? []) as PendingProfileRow[];

  return (
    <div className="min-h-screen bg-neutral-100 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-black/5 bg-white/80 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                Superadmin
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
                Onay Paneli
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
                Bekleyen kullanicilari onaylayin, reddedin ve gerekli ise rol atayin.
                Liste dogrudan Supabase profiles tablosundan okunur.
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                Giris yapan
              </div>
              <div className="mt-1 font-semibold text-neutral-900">
                {getProfileDisplayName(profile)}
              </div>
              <div className="mt-1 text-neutral-600">{profile.email}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.16em] text-neutral-500">
                Rol: {profile.role}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Bekleyen
            </div>
            <div className="mt-2 text-2xl font-semibold text-neutral-900">
              {pendingProfiles.length}
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Onay bekleyen hesap sayisi.
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Islem
            </div>
            <div className="mt-2 text-lg font-semibold text-neutral-900">
              Approved / Rejected
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Her satirda rol secip ayni anda onay veya ret verebilirsiniz.
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Kaynak
            </div>
            <div className="mt-2 text-lg font-semibold text-neutral-900">
              Supabase profiles
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Mock veya local auth listesi kullanilmiyor.
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
          <div className="border-b border-black/5 px-6 py-4">
            <div className="text-lg font-semibold text-neutral-900">
              Bekleyen Kullanici Listesi
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Alanlar: email, rol, status, kayit tarihi.
            </div>
          </div>

          {error ? (
            <div className="px-6 py-6 text-sm text-red-700">
              Liste okunamadi: {error.message}
            </div>
          ) : pendingProfiles.length ? (
            <div className="divide-y divide-black/5">
              {pendingProfiles.map((entry) => (
                <form
                  key={entry.id}
                  action={updatePendingProfileAction}
                  className="flex flex-col gap-4 px-6 py-5"
                >
                  <input type="hidden" name="profileId" value={entry.id} />

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_140px_140px_180px]">
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">
                        {entry.full_name?.trim() || entry.email || "-"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {entry.email || "-"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                        Mevcut Rol
                      </div>
                      <div className="mt-1 text-sm font-medium text-neutral-900">
                        {normalizeProfileRole(entry.role)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                        Status
                      </div>
                      <div className="mt-1 text-sm font-medium text-neutral-900">
                        {entry.status || "pending"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                        Kayit Tarihi
                      </div>
                      <div className="mt-1 text-sm font-medium text-neutral-900">
                        {formatCreatedAt(entry.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-black/5 pt-4 md:flex-row md:items-end md:justify-between">
                    <label className="block">
                      <div className="mb-1 text-xs uppercase tracking-[0.16em] text-neutral-500">
                        Atanacak Rol
                      </div>
                      <select
                        name="role"
                        defaultValue={normalizeProfileRole(entry.role)}
                        className="min-w-[180px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        name="nextStatus"
                        value="approved"
                        className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                      >
                        Onayla
                      </button>
                      <button
                        type="submit"
                        name="nextStatus"
                        value="rejected"
                        className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-400"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                </form>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-sm text-neutral-500">
              Bekleyen kullanici yok.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
