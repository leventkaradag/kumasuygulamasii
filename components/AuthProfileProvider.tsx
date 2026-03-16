'use client'

import { createContext, useContext } from 'react'
import {
  canRoleEdit,
  getAccessibleMenuItems,
  getRolePermissions,
  getVisibleModules,
  hasPermission as checkRolePermission,
  isReadOnlyRole,
  type AppModuleKey,
  type RolePermissions,
} from '@/lib/authz/access'
import {
  type AppProfile,
  getProfileDisplayName,
  isSuperadminProfile,
} from '@/lib/supabase/profile-access'

const defaultPermissions: RolePermissions = {
  modules: {
    dashboard: false,
    ozetler: false,
    desenler: false,
    dokuma: false,
    boyahane: false,
    depo: false,
    'sevk-rezerv': false,
    raporlar: false,
    ayarlar: false,
    'admin-paneli': false,
  },
  patterns: {
    view: false,
    create: false,
    edit: false,
    delete: false,
  },
  weaving: {
    view: false,
    create: false,
    edit: false,
    delete: false,
    advance: false,
  },
  dyehouse: {
    view: false,
    create: false,
    edit: false,
    delete: false,
    advance: false,
  },
  warehouse: {
    view: false,
    create: false,
    edit: false,
    delete: false,
    operate: false,
  },
  dispatch: {
    view: false,
    create: false,
    edit: false,
    delete: false,
  },
  reservation: {
    view: false,
    create: false,
    edit: false,
    delete: false,
  },
  reports: {
    view: false,
  },
  adminPanel: {
    access: false,
  },
  users: {
    manage: false,
    approve: false,
    changeRole: false,
    delete: false,
  },
}

type AuthProfileContextValue = {
  profile: AppProfile | null
  canEdit: boolean
  displayName: string
  menuItems: Array<{ href: string; key: string; label: string }>
  permissions: RolePermissions
  role: string
  isSuperadmin: boolean
  isReadOnly: boolean
  visibleModules: AppModuleKey[]
  hasPermission: (permissionPath: string) => boolean
}

const AuthProfileContext = createContext<AuthProfileContextValue>({
  canEdit: false,
  profile: null,
  displayName: 'Misafir',
  menuItems: [],
  permissions: defaultPermissions,
  role: '-',
  isSuperadmin: false,
  isReadOnly: false,
  visibleModules: [],
  hasPermission: () => false,
})

export function AuthProfileProvider({
  children,
  profile,
}: Readonly<{
  children: React.ReactNode
  profile: AppProfile | null
}>) {
  const permissions = profile ? getRolePermissions(profile.role) : defaultPermissions
  const visibleModules = profile ? getVisibleModules(profile.role) : []

  return (
    <AuthProfileContext.Provider
      value={{
        canEdit: profile ? canRoleEdit(profile.role) : false,
        profile,
        displayName: getProfileDisplayName(profile),
        menuItems: profile ? getAccessibleMenuItems(profile.role) : [],
        permissions,
        role: profile?.role ?? '-',
        isSuperadmin: isSuperadminProfile(profile),
        isReadOnly: profile ? isReadOnlyRole(profile.role) : false,
        visibleModules,
        hasPermission: (permissionPath) =>
          profile ? checkRolePermission(profile.role, permissionPath) : false,
      }}
    >
      {children}
    </AuthProfileContext.Provider>
  )
}

export function useAuthProfile() {
  return useContext(AuthProfileContext)
}
