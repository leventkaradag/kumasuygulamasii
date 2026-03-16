export type ProfileAccessStatus = 'approved' | 'pending' | 'rejected' | 'missing'
export type ProfileRole = 'user' | 'admin' | 'superadmin' | string

export type AppProfile = {
  id: string
  email: string | null
  fullName: string | null
  role: ProfileRole
  status: ProfileAccessStatus
  createdAt: string | null
}

export function normalizeProfileStatus(status: string | null | undefined) {
  if (status === 'approved' || status === 'rejected') {
    return status
  }

  return 'pending'
}

export function normalizeProfileRole(role: string | null | undefined): ProfileRole {
  const nextRole = role?.trim()
  return nextRole ? nextRole : 'user'
}

export async function getProfileAccessStatus(
  supabase: { from: (table: string) => any },
  userId: string
): Promise<{ email: string | null; status: ProfileAccessStatus }> {
  const profile = await getProfileByUserId(supabase, userId)

  if (!profile) {
    return {
      email: null,
      status: 'missing',
    }
  }

  return {
    email: profile.email,
    status: profile.status,
  }
}

export async function getProfileByUserId(
  supabase: { from: (table: string) => any },
  userId: string
): Promise<AppProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,status,created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    id: data.id ?? userId,
    email: data.email ?? null,
    fullName: data.full_name ?? null,
    role: normalizeProfileRole(data.role),
    status: normalizeProfileStatus(data.status),
    createdAt: data.created_at ?? null,
  }
}

export function getAuthenticatedRedirectPath(status: ProfileAccessStatus) {
  return status === 'approved' ? '/dashboard' : '/pending'
}

export function isApprovedProfile(status: ProfileAccessStatus) {
  return status === 'approved'
}

export function isSuperadminProfile(profile: AppProfile | null | undefined) {
  return !!profile && profile.role === 'superadmin' && isApprovedProfile(profile.status)
}

export function getProfileDisplayName(profile: AppProfile | null | undefined) {
  const fullName = profile?.fullName?.trim()

  if (fullName) {
    return fullName
  }

  return profile?.email ?? 'Misafir'
}
