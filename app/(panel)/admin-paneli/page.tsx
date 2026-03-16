import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APP_ROLE_OPTIONS } from "@/lib/authz/access";
import {
  getProfileByUserId,
  getProfileDisplayName,
  isApprovedProfile,
  isSuperadminProfile,
  normalizeProfileRole,
  normalizeProfileStatus,
} from "@/lib/supabase/profile-access";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminProfileRow = {
  created_at: string | null;
  email: string | null;
  full_name: string | null;
  id: string;
  role: string | null;
  status: string | null;
};

const MANAGEABLE_STATUSES = ["approved", "pending", "rejected"] as const;

function getSingleParam(
  searchParams: SearchParams | undefined,
  key: "error" | "success"
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
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

function roleBadgeClass(role: string) {
  if (role === "superadmin") {
    return "border-rose-500/30 bg-rose-50 text-rose-700";
  }
  if (role === "admin") {
    return "border-amber-500/30 bg-amber-50 text-amber-700";
  }
  if (role === "depo" || role === "dokuma" || role === "boyahane") {
    return "border-sky-500/30 bg-sky-50 text-sky-700";
  }
  return "border-black/10 bg-neutral-50 text-neutral-700";
}

function statusBadgeClass(status: string) {
  if (status === "approved") {
    return "border-emerald-500/30 bg-emerald-50 text-emerald-700";
  }
  if (status === "rejected") {
    return "border-rose-500/30 bg-rose-50 text-rose-700";
  }
  return "border-amber-500/30 bg-amber-50 text-amber-700";
}

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

  return { currentProfile: profile, supabase };
}

async function countApprovedSuperadmins(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("status", "approved")
    .eq("role", "superadmin");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length;
}

async function loadTargetProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,status,created_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Kullanici profili bulunamadi.");
  }

  return data as AdminProfileRow;
}

function guardLastSuperadmin(
  target: AdminProfileRow,
  nextRole: string,
  nextStatus: string,
  approvedSuperadminCount: number
) {
  const currentRole = normalizeProfileRole(target.role);
  const currentStatus = normalizeProfileStatus(target.status);
  const isActiveSuperadmin =
    currentRole === "superadmin" && currentStatus === "approved";
  const losesSuperadminAccess =
    nextRole !== "superadmin" || normalizeProfileStatus(nextStatus) !== "approved";

  if (isActiveSuperadmin && losesSuperadminAccess && approvedSuperadminCount <= 1) {
    throw new Error("Son aktif superadmin devre disi birakilamaz.");
  }
}

function redirectWithFeedback(kind: "error" | "success", message: string) {
  redirect(`/admin-paneli?${kind}=${encodeURIComponent(message)}`);
}

async function updatePendingUserAction(formData: FormData) {
  "use server";

  const { supabase } = await requireSuperadminAccess();
  const profileId = String(formData.get("profileId") ?? "").trim();
  const nextStatus = String(formData.get("nextStatus") ?? "").trim();
  const nextRole = normalizeProfileRole(String(formData.get("role") ?? "viewer"));

  if (!profileId) {
    redirectWithFeedback("error", "Kullanici secilemedi.");
  }

  if (nextStatus !== "approved" && nextStatus !== "rejected") {
    redirectWithFeedback("error", "Gecersiz durum secildi.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      role: nextRole,
      status: nextStatus,
    })
    .eq("id", profileId);

  if (error) {
    redirectWithFeedback("error", error.message);
  }

  revalidatePath("/admin-paneli");
  redirectWithFeedback("success", "Bekleyen kullanici guncellendi.");
}

async function updateExistingUserAction(formData: FormData) {
  "use server";

  const { supabase } = await requireSuperadminAccess();
  const profileId = String(formData.get("profileId") ?? "").trim();
  const nextRole = normalizeProfileRole(String(formData.get("role") ?? "viewer"));
  const nextStatus = String(formData.get("status") ?? "").trim();

  if (!profileId) {
    redirectWithFeedback("error", "Kullanici secilemedi.");
  }

  if (!MANAGEABLE_STATUSES.includes(nextStatus as (typeof MANAGEABLE_STATUSES)[number])) {
    redirectWithFeedback("error", "Gecersiz kullanici durumu.");
  }

  try {
    const target = await loadTargetProfile(supabase, profileId);
    const approvedSuperadminCount = await countApprovedSuperadmins(supabase);
    guardLastSuperadmin(target, nextRole, nextStatus, approvedSuperadminCount);

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
  } catch (error) {
    redirectWithFeedback(
      "error",
      error instanceof Error ? error.message : "Kullanici guncellenemedi."
    );
  }

  revalidatePath("/admin-paneli");
  redirectWithFeedback("success", "Kullanici bilgileri guncellendi.");
}

async function softRemoveUserAction(formData: FormData) {
  "use server";

  const { supabase } = await requireSuperadminAccess();
  const profileId = String(formData.get("profileId") ?? "").trim();

  if (!profileId) {
    redirectWithFeedback("error", "Kullanici secilemedi.");
  }

  try {
    const target = await loadTargetProfile(supabase, profileId);
    const approvedSuperadminCount = await countApprovedSuperadmins(supabase);
    guardLastSuperadmin(target, normalizeProfileRole(target.role), "rejected", approvedSuperadminCount);

    const { error } = await supabase
      .from("profiles")
      .update({
        status: "rejected",
      })
      .eq("id", profileId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithFeedback(
      "error",
      error instanceof Error ? error.message : "Kullanici sistemden cikarilamadi."
    );
  }

  revalidatePath("/admin-paneli");
  redirectWithFeedback("success", "Kullanici sistemden cikarildi.");
}

export default async function AdminPanelPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const [resolvedSearchParams, { currentProfile, supabase }] = await Promise.all([
    searchParams,
    requireSuperadminAccess(),
  ]);

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,status,created_at")
    .order("created_at", { ascending: false });

  const allProfiles = ((data ?? []) as AdminProfileRow[]).map((profile) => ({
    ...profile,
    role: normalizeProfileRole(profile.role),
    status: normalizeProfileStatus(profile.status),
  }));

  const pendingProfiles = allProfiles.filter((profile) => profile.status === "pending");
  const approvedProfiles = allProfiles.filter((profile) => profile.status === "approved");
  const rejectedProfiles = allProfiles.filter((profile) => profile.status === "rejected");
  const existingProfiles = allProfiles.filter((profile) => profile.status !== "pending");

  const successMessage = getSingleParam(resolvedSearchParams, "success");
  const errorMessage = getSingleParam(resolvedSearchParams, "error");

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
                Admin Paneli
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
                Kullanici onaylarini, rol atamalarini ve sistemden cikarma islemlerini
                tek panelden yonetin.
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                Giris yapan
              </div>
              <div className="mt-1 font-semibold text-neutral-900">
                {getProfileDisplayName(currentProfile)}
              </div>
              <div className="mt-1 text-neutral-600">{currentProfile.email}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.16em] text-neutral-500">
                Rol: {currentProfile.role}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Bekleyen" value={pendingProfiles.length} />
          <SummaryCard label="Onayli" value={approvedProfiles.length} />
          <SummaryCard label="Reddedilen" value={rejectedProfiles.length} />
          <SummaryCard label="Toplam" value={allProfiles.length} />
        </section>

        {successMessage ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
          <div className="border-b border-black/5 px-6 py-4">
            <div className="text-lg font-semibold text-neutral-900">
              Bekleyen Kullanicilar
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Status = pending olan kayitlar.
            </div>
          </div>

          {error ? (
            <div className="px-6 py-6 text-sm text-rose-700">
              Liste okunamadi: {error.message}
            </div>
          ) : pendingProfiles.length ? (
            <div className="divide-y divide-black/5">
              {pendingProfiles.map((entry) => (
                <form
                  key={entry.id}
                  action={updatePendingUserAction}
                  className="flex flex-col gap-4 px-6 py-5"
                >
                  <input type="hidden" name="profileId" value={entry.id} />

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_140px_140px_180px]">
                    <UserIdentityCell entry={entry} />
                    <FieldCell label="Mevcut Rol">
                      <RoleBadge role={entry.role} />
                    </FieldCell>
                    <FieldCell label="Status">
                      <StatusBadge status={entry.status} />
                    </FieldCell>
                    <FieldCell label="Kayit Tarihi">
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCreatedAt(entry.created_at)}
                      </span>
                    </FieldCell>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-black/5 pt-4 md:flex-row md:items-end md:justify-between">
                    <label className="block">
                      <div className="mb-1 text-xs uppercase tracking-[0.16em] text-neutral-500">
                        Rol
                      </div>
                      <select
                        name="role"
                        defaultValue={entry.role}
                        className="min-w-[180px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                      >
                        {APP_ROLE_OPTIONS.map((roleOption) => (
                          <option key={roleOption.value} value={roleOption.value}>
                            {roleOption.label}
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

        <section className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
          <div className="border-b border-black/5 px-6 py-4">
            <div className="text-lg font-semibold text-neutral-900">
              Mevcut Kullanicilar
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Onayli ve rejected kayitlari yonetin. Silme yerine guvenli soft remove
              uygulanir ve status rejected yapilir.
            </div>
          </div>

          {existingProfiles.length ? (
            <div className="divide-y divide-black/5">
              {existingProfiles.map((entry) => (
                <form
                  key={entry.id}
                  action={updateExistingUserAction}
                  className="flex flex-col gap-4 px-6 py-5"
                >
                  <input type="hidden" name="profileId" value={entry.id} />

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_160px_160px_180px_auto]">
                    <UserIdentityCell entry={entry} isCurrentUser={entry.id === currentProfile.id} />
                    <FieldCell label="Rol">
                      <RoleBadge role={entry.role} />
                    </FieldCell>
                    <FieldCell label="Status">
                      <StatusBadge status={entry.status} />
                    </FieldCell>
                    <FieldCell label="Kayit Tarihi">
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCreatedAt(entry.created_at)}
                      </span>
                    </FieldCell>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="block">
                        <div className="mb-1 text-xs uppercase tracking-[0.16em] text-neutral-500">
                          Yeni Rol
                        </div>
                        <select
                          name="role"
                          defaultValue={entry.role}
                          className="min-w-[160px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                        >
                          {APP_ROLE_OPTIONS.map((roleOption) => (
                            <option key={roleOption.value} value={roleOption.value}>
                              {roleOption.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <div className="mb-1 text-xs uppercase tracking-[0.16em] text-neutral-500">
                          Yeni Status
                        </div>
                        <select
                          name="status"
                          defaultValue={entry.status}
                          className="min-w-[160px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                        >
                          {MANAGEABLE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 border-t border-black/5 pt-4">
                    <button
                      type="submit"
                      className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                    >
                      Degisiklikleri Kaydet
                    </button>
                    <ConfirmSubmitButton
                      className="rounded-xl border border-rose-500/30 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      confirmMessage="Bu kullanici sistemden cikarilsin mi? Bu islem soft remove uygular ve status rejected yapar."
                      formAction={softRemoveUserAction}
                    >
                      Sistemden Cikar
                    </ConfirmSubmitButton>
                  </div>
                </form>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-sm text-neutral-500">
              Yonetilecek aktif kullanici yok.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function UserIdentityCell({
  entry,
  isCurrentUser = false,
}: {
  entry: AdminProfileRow & { role: string; status: string };
  isCurrentUser?: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-neutral-900">
          {entry.full_name?.trim() || entry.email || "-"}
        </div>
        {isCurrentUser ? (
          <span className="rounded-full border border-black/10 bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
            Siz
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-sm text-neutral-500">{entry.email || "-"}</div>
    </div>
  );
}

function FieldCell({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(role)}`}
    >
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}
    >
      {status}
    </span>
  );
}
