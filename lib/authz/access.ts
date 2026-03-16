export const APP_ROLES = [
  'viewer',
  'depo',
  'dokuma',
  'boyahane',
  'admin',
  'superadmin',
] as const

export type AppRole = (typeof APP_ROLES)[number]

export const APP_MODULES = [
  'dashboard',
  'ozetler',
  'desenler',
  'dokuma',
  'boyahane',
  'depo',
  'sevk-rezerv',
  'raporlar',
  'ayarlar',
  'admin-paneli',
] as const

export type AppModuleKey = (typeof APP_MODULES)[number]

type CrudPermission = {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

type WorkflowPermission = CrudPermission & {
  advance: boolean
}

type WarehousePermission = CrudPermission & {
  operate: boolean
}

type ReportsPermission = {
  view: boolean
}

type AdminPanelPermission = {
  access: boolean
}

type UsersPermission = {
  manage: boolean
  approve: boolean
  changeRole: boolean
  delete: boolean
}

export type RolePermissions = {
  modules: Record<AppModuleKey, boolean>
  patterns: CrudPermission
  weaving: WorkflowPermission
  dyehouse: WorkflowPermission
  warehouse: WarehousePermission
  dispatch: CrudPermission
  reservation: CrudPermission
  reports: ReportsPermission
  adminPanel: AdminPanelPermission
  users: UsersPermission
}

export type AppMenuItem = {
  href: string
  key: AppModuleKey
  label: string
}

type RouteAccessRule = {
  key: string
  matches: (pathname: string) => boolean
  allow: (role: AppRole) => boolean
}

type CrudResourceKey = 'patterns' | 'dispatch' | 'reservation'
type MutationResourceKey = 'patterns' | 'weaving' | 'dyehouse' | 'warehouse' | 'dispatch' | 'reservation'
type WorkflowResourceKey = 'weaving' | 'dyehouse'

const readOnlyCrud: CrudPermission = {
  view: true,
  create: false,
  edit: false,
  delete: false,
}

const fullCrud: CrudPermission = {
  view: true,
  create: true,
  edit: true,
  delete: true,
}

const noCrud: CrudPermission = {
  view: false,
  create: false,
  edit: false,
  delete: false,
}

const readOnlyWorkflow: WorkflowPermission = {
  ...readOnlyCrud,
  advance: false,
}

const fullWorkflow: WorkflowPermission = {
  ...fullCrud,
  advance: true,
}

const noWorkflow: WorkflowPermission = {
  ...noCrud,
  advance: false,
}

const readOnlyWarehouse: WarehousePermission = {
  ...readOnlyCrud,
  operate: false,
}

const fullWarehouse: WarehousePermission = {
  ...fullCrud,
  operate: true,
}

const noWarehouse: WarehousePermission = {
  ...noCrud,
  operate: false,
}

const noUsersPermission: UsersPermission = {
  manage: false,
  approve: false,
  changeRole: false,
  delete: false,
}

const fullUsersPermission: UsersPermission = {
  manage: true,
  approve: true,
  changeRole: true,
  delete: true,
}

const createModules = (...visibleModules: AppModuleKey[]) =>
  Object.fromEntries(
    APP_MODULES.map((moduleKey) => [moduleKey, visibleModules.includes(moduleKey)])
  ) as Record<AppModuleKey, boolean>

const ROLE_PERMISSIONS: Record<AppRole, RolePermissions> = {
  viewer: {
    modules: createModules(
      'dashboard',
      'ozetler',
      'desenler',
      'dokuma',
      'boyahane',
      'depo',
      'sevk-rezerv',
      'raporlar'
    ),
    patterns: readOnlyCrud,
    weaving: readOnlyWorkflow,
    dyehouse: readOnlyWorkflow,
    warehouse: readOnlyWarehouse,
    dispatch: readOnlyCrud,
    reservation: readOnlyCrud,
    reports: { view: true },
    adminPanel: { access: false },
    users: noUsersPermission,
  },
  depo: {
    modules: createModules('depo', 'sevk-rezerv'),
    patterns: noCrud,
    weaving: noWorkflow,
    dyehouse: noWorkflow,
    warehouse: fullWarehouse,
    dispatch: fullCrud,
    reservation: fullCrud,
    reports: { view: false },
    adminPanel: { access: false },
    users: noUsersPermission,
  },
  dokuma: {
    modules: createModules('dokuma'),
    patterns: noCrud,
    weaving: fullWorkflow,
    dyehouse: noWorkflow,
    warehouse: noWarehouse,
    dispatch: {
      view: true,
      create: true,
      edit: true,
      delete: false,
    },
    reservation: noCrud,
    reports: { view: false },
    adminPanel: { access: false },
    users: noUsersPermission,
  },
  boyahane: {
    modules: createModules('boyahane'),
    patterns: noCrud,
    weaving: noWorkflow,
    dyehouse: fullWorkflow,
    warehouse: noWarehouse,
    dispatch: {
      view: true,
      create: true,
      edit: true,
      delete: false,
    },
    reservation: noCrud,
    reports: { view: false },
    adminPanel: { access: false },
    users: noUsersPermission,
  },
  admin: {
    modules: createModules(
      'dashboard',
      'ozetler',
      'desenler',
      'dokuma',
      'boyahane',
      'depo',
      'sevk-rezerv',
      'raporlar',
      'ayarlar'
    ),
    patterns: fullCrud,
    weaving: fullWorkflow,
    dyehouse: fullWorkflow,
    warehouse: fullWarehouse,
    dispatch: fullCrud,
    reservation: fullCrud,
    reports: { view: true },
    adminPanel: { access: false },
    users: noUsersPermission,
  },
  superadmin: {
    modules: createModules(
      'dashboard',
      'ozetler',
      'desenler',
      'dokuma',
      'boyahane',
      'depo',
      'sevk-rezerv',
      'raporlar',
      'ayarlar',
      'admin-paneli'
    ),
    patterns: fullCrud,
    weaving: fullWorkflow,
    dyehouse: fullWorkflow,
    warehouse: fullWarehouse,
    dispatch: fullCrud,
    reservation: fullCrud,
    reports: { view: true },
    adminPanel: { access: true },
    users: fullUsersPermission,
  },
}

const menuItems: AppMenuItem[] = [
  {
    key: 'dashboard',
    href: '/dashboard',
    label: 'Kontrol Paneli',
  },
  {
    key: 'ozetler',
    href: '/ozetler',
    label: 'Ozetler',
  },
  {
    key: 'desenler',
    href: '/desenler',
    label: 'Desenler',
  },
  {
    key: 'dokuma',
    href: '/dokuma',
    label: 'Dokuma',
  },
  {
    key: 'boyahane',
    href: '/boyahane',
    label: 'Boyahane',
  },
  {
    key: 'depo',
    href: '/depo',
    label: 'Depo',
  },
  {
    key: 'sevk-rezerv',
    href: '/sevk-rezerv',
    label: 'Sevk/Rezerv Belgeleri',
  },
  {
    key: 'raporlar',
    href: '/raporlar',
    label: 'Raporlar',
  },
  {
    key: 'ayarlar',
    href: '/ayarlar',
    label: 'Ayarlar',
  },
  {
    key: 'admin-paneli',
    href: '/admin-paneli',
    label: 'Admin Paneli',
  },
]

const routeAccessRules: RouteAccessRule[] = [
  {
    key: 'admin-paneli',
    matches: (pathname) =>
      pathname === '/admin-paneli' ||
      pathname.startsWith('/admin-paneli/') ||
      pathname === '/onay-paneli' ||
      pathname.startsWith('/onay-paneli/') ||
      pathname === '/superadmin' ||
      pathname.startsWith('/superadmin/'),
    allow: (role) => canUseAdminPanel(role),
  },
  {
    key: 'dashboard',
    matches: (pathname) => pathname === '/dashboard' || pathname.startsWith('/dashboard/'),
    allow: (role) => canViewModule(role, 'dashboard'),
  },
  {
    key: 'ozetler',
    matches: (pathname) => pathname === '/ozetler' || pathname.startsWith('/ozetler/'),
    allow: (role) => canViewModule(role, 'ozetler'),
  },
  {
    key: 'desenler',
    matches: (pathname) => pathname === '/desenler' || pathname.startsWith('/desenler/'),
    allow: (role) => canViewModule(role, 'desenler'),
  },
  {
    key: 'dokuma',
    matches: (pathname) => pathname === '/dokuma' || pathname.startsWith('/dokuma/'),
    allow: (role) => canViewModule(role, 'dokuma'),
  },
  {
    key: 'boyahane',
    matches: (pathname) => pathname === '/boyahane' || pathname.startsWith('/boyahane/'),
    allow: (role) => canViewModule(role, 'boyahane'),
  },
  {
    key: 'depo',
    matches: (pathname) =>
      pathname === '/depo' ||
      pathname.startsWith('/depo/') ||
      pathname === '/sevk-rezerv' ||
      pathname.startsWith('/sevk-rezerv/'),
    allow: (role) =>
      canViewModule(role, 'depo') || canViewModule(role, 'sevk-rezerv'),
  },
  {
    key: 'raporlar',
    matches: (pathname) => pathname === '/raporlar' || pathname.startsWith('/raporlar/'),
    allow: (role) => canViewModule(role, 'raporlar'),
  },
  {
    key: 'ayarlar',
    matches: (pathname) =>
      pathname === '/ayarlar' ||
      pathname.startsWith('/ayarlar/') ||
      pathname === '/notlar' ||
      pathname.startsWith('/notlar/') ||
      pathname === '/siparis' ||
      pathname.startsWith('/siparis/'),
    allow: (role) => canViewModule(role, 'ayarlar'),
  },
  {
    key: 'weaving-print',
    matches: (pathname) => pathname.startsWith('/sevk/'),
    allow: (role) => getRolePermissions(role).dispatch.view,
  },
]

export const APP_ROLE_OPTIONS = APP_ROLES.map((role) => ({
  label: role,
  value: role,
}))

export function normalizeAppRole(role: string | null | undefined): AppRole {
  if (role === 'user') {
    return 'viewer'
  }

  return APP_ROLES.includes(role as AppRole) ? (role as AppRole) : 'viewer'
}

export function getRolePermissions(role: AppRole): RolePermissions {
  return ROLE_PERMISSIONS[role]
}

export function getVisibleModules(role: AppRole) {
  return APP_MODULES.filter((moduleKey) => ROLE_PERMISSIONS[role].modules[moduleKey])
}

export function isReadOnlyRole(role: AppRole) {
  return role === 'viewer'
}

export function getDefaultRouteForRole(role: AppRole) {
  if (role === 'depo') return '/depo'
  if (role === 'dokuma') return '/dokuma'
  if (role === 'boyahane') return '/boyahane'
  return '/dashboard'
}

export function canRoleEdit(role: AppRole) {
  return !isReadOnlyRole(role)
}

export function isSuperadminRole(role: AppRole) {
  return role === 'superadmin'
}

export function canViewModule(role: AppRole, moduleKey: AppModuleKey) {
  return getRolePermissions(role).modules[moduleKey]
}

function getCrudPermission(role: AppRole, resource: CrudResourceKey): CrudPermission {
  return getRolePermissions(role)[resource]
}

function getMutationPermission(
  role: AppRole,
  resource: MutationResourceKey
): CrudPermission | WorkflowPermission | WarehousePermission {
  return getRolePermissions(role)[resource]
}

export function canCreate(role: AppRole, resource: MutationResourceKey) {
  return getMutationPermission(role, resource).create
}

export function canEdit(role: AppRole, resource: MutationResourceKey) {
  return getMutationPermission(role, resource).edit
}

export function canDelete(role: AppRole, resource: MutationResourceKey) {
  return getMutationPermission(role, resource).delete
}

export function canMutate(role: AppRole, resource: MutationResourceKey) {
  const permission = getMutationPermission(role, resource)
  return permission.create || permission.edit || permission.delete
}

export function canApproveUsers(role: AppRole) {
  return getRolePermissions(role).users.approve
}

export function canChangeRoles(role: AppRole) {
  return getRolePermissions(role).users.changeRole
}

export function canManageWarehouse(role: AppRole) {
  return getRolePermissions(role).warehouse.operate
}

export function canCreateDispatch(role: AppRole) {
  return getRolePermissions(role).dispatch.create
}

export function canCreateReservation(role: AppRole) {
  return getRolePermissions(role).reservation.create
}

export function canAdvanceWorkflow(role: AppRole, resource: WorkflowResourceKey = 'weaving') {
  return getRolePermissions(role)[resource].advance
}

export function canUseAdminPanel(role: AppRole) {
  return getRolePermissions(role).adminPanel.access
}

export function hasPermission(role: AppRole, permissionPath: string) {
  const segments = permissionPath.split('.').filter(Boolean)
  let current: unknown = getRolePermissions(role)

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return false
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current === true
}

export function getAccessibleMenuItems(role: AppRole) {
  return menuItems.filter((item) => canViewModule(role, item.key))
}

export function canAccessPath(role: AppRole, pathname: string) {
  const matchedRule = routeAccessRules.find((rule) => rule.matches(pathname))

  if (!matchedRule) {
    return true
  }

  return matchedRule.allow(role)
}

