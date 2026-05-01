import { redirect } from "next/navigation";
import { AuthProfileProvider } from "@/components/AuthProfileProvider";
import Sidebar from "@/components/Sidebar";
import { getProfileByUserId, isApprovedProfile } from "@/lib/supabase/profile-access";
import { createClient } from "@/lib/supabase/server";

export default async function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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

  return (
    <AuthProfileProvider profile={profile}>
      <div className="flex min-h-screen overflow-x-hidden bg-coffee-surface">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </AuthProfileProvider>
  );
}
