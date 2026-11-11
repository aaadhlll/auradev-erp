export type ViewId = 'dashboard' | 'pos' | 'bills' | 'inventory' | 'purchases' | 'settings'

export type ModuleId = 'overview' | 'pos' | 'inventory' | 'procurement' | 'administration'

export interface MercantileModule {
  id: ModuleId
  label: string
  description: string
  icon: string
  defaultView: ViewId
  views: ViewId[]
  tone: string
  route: string
}

export const MERCANTILE_MODULES: MercantileModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Monitor sales, stock and business activity',
    icon: 'layout-dashboard',
    defaultView: 'dashboard',
    views: ['dashboard'],
    tone: 'emerald',
    route: '/overview/dashboard',
  },
  {
    id: 'pos',
    label: 'Point of Sale',
    description: 'Process sales, payments and customer bills',
    icon: 'scan-line',
    defaultView: 'pos',
    views: ['pos', 'bills'],
    tone: 'blue',
    route: '/pos/dashboard',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Manage products, stock and catalog data',
    icon: 'boxes',
    defaultView: 'inventory',
    views: ['inventory'],
    tone: 'cyan',
    route: '/inventory/dashboard',
  },
  {
    id: 'procurement',
    label: 'Procurement',
    description: 'Control suppliers, purchases and receiving',
    icon: 'truck',
    defaultView: 'purchases',
    views: ['purchases'],
    tone: 'violet',
    route: '/procurement/dashboard',
  },
  {
    id: 'administration',
    label: 'Administration',
    description: 'Configure the store, users and permissions',
    icon: 'settings',
    defaultView: 'settings',
    views: ['settings'],
    tone: 'amber',
    route: '/administration/dashboard',
  },
]

export function moduleForView(view: ViewId): MercantileModule {
  return MERCANTILE_MODULES.find(module => module.views.includes(view)) ?? MERCANTILE_MODULES[0]
}

export function moduleForRoute(pathname: string): MercantileModule | undefined {
  return MERCANTILE_MODULES.find(module => pathname.startsWith(`/${module.id}/`))
}
