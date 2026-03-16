import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedRedirectPath,
  getProfileByUserId,
} from "@/lib/supabase/profile-access";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileByUserId(supabase, user.id);
  redirect(getAuthenticatedRedirectPath(profile));
}
