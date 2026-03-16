'use client'

import { createContext, useContext } from 'react'
import {
  type AppProfile,
  getProfileDisplayName,
  isSuperadminProfile,
} from '@/lib/supabase/profile-access'

type AuthProfileContextValue = {
  profile: AppProfile | null
  displayName: string
  role: string
  isSuperadmin: boolean
}

const AuthProfileContext = createContext<AuthProfileContextValue>({
  profile: null,
  displayName: 'Misafir',
  role: '-',
  isSuperadmin: false,
})

export function AuthProfileProvider({
  children,
  profile,
}: Readonly<{
  children: React.ReactNode
  profile: AppProfile | null
}>) {
  return (
    <AuthProfileContext.Provider
      value={{
        profile,
        displayName: getProfileDisplayName(profile),
        role: profile?.role ?? '-',
        isSuperadmin: isSuperadminProfile(profile),
      }}
    >
      {children}
    </AuthProfileContext.Provider>
  )
}

export function useAuthProfile() {
  return useContext(AuthProfileContext)
}
