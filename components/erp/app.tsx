'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ToastProvider } from './ui'
import { Sidebar, Topbar, type ViewId } from './shell'
import { GlobalSearch, type GlobalSearchSelect } from './global-search'
import { Dashboard } from './dashboard'
import { POS } from './pos'
import { Inventory, type InventorySectionId } from './inventory'
import { Purchases } from './purchases'
import { Bills } from './bills'
import { Settings } from './settings'
import { LoginScreen } from './login'
import { BrandedLoader } from './branded-loader'
import { useAuth } from '@/lib/auth-context'
import { canAccessView, firstAccessibleView } from '@/lib/rbac'
import { useTheme } from '@/lib/theme'
import { ModuleHub } from './module-hub'
import { ModuleLayout } from './module-layout'
import { moduleForRoute, moduleForView } from '@/lib/modules'
import type { SettingsSectionId } from '@/lib/rbac'

function AppInner() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<ViewId>(() => moduleForRoute(pathname)?.defaultView ?? 'dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [prefill, setPrefill] = useState<{ view: ViewId; q: string; key: number } | null>(null)
  const [openBillId, setOpenBillId] = useState<string | null>(null)
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('store')
  const [inventorySection, setInventorySection] = useState<InventorySectionId>('items')

  useEffect(() => {
    const routeModule = moduleForRoute(pathname)
    if (!routeModule || !user) return
    if (canAccessView(user, routeModule.defaultView)) return
    const fallback = firstAccessibleView(user)
    router.replace(moduleForView(fallback).route)
  }, [pathname, router, user])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view === 'pos') return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view])

  useEffect(() => {
    if (view === 'pos') setSearchOpen(false)
  }, [view])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [view])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)')
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('nav-open', mobileNavOpen)
    return () => document.body.classList.remove('nav-open')
  }, [mobileNavOpen])

  useEffect(() => {
    if (user && !canAccessView(user, view)) {
      setView(firstAccessibleView(user))
    }
  }, [user, view])

  function handleSearchSelect(sel: GlobalSearchSelect) {
    if (sel.view === 'inventory') setInventorySection('items')
    navigateToView(sel.view)
    if (sel.billId) {
      setOpenBillId(sel.billId)
      return
    }
    if (sel.query) setPrefill({ view: sel.view, q: sel.query, key: Date.now() })
  }

  function navigateToView(next: ViewId) {
    if (next === 'inventory') setInventorySection('items')
    setView(next)
    const nextModule = moduleForView(next)
    const routeModule = moduleForRoute(pathname)
    if (routeModule?.id !== nextModule.id) router.push(nextModule.route)
  }

  if (pathname === '/home') return <ModuleHub />

  const isPOS = view === 'pos'

  return (
    <ModuleLayout
      backdrop={mobileNavOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      sidebar={<Sidebar
        view={view}
        setView={navigateToView}
        collapsed={collapsed}
        mobileOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
        onOpenModules={() => router.push('/home')}
        settingsSection={settingsSection}
        onSettingsSectionChange={setSettingsSection}
        inventorySection={inventorySection}
        onInventorySectionChange={setInventorySection}
      />}
      topbar={<Topbar
          view={view}
          theme={theme}
          onToggleTheme={toggleTheme}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onMobileNav={() => setMobileNavOpen(o => !o)}
          onCmd={() => setSearchOpen(true)}
        />}
    >
        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSearchSelect}
        />
        <div className={'content' + (isPOS ? ' pos-mode' : '')}>
          <div className="dashboard-mount" style={{ display: view === 'dashboard' ? 'block' : 'none' }}>
            <Dashboard
              setView={(v) => navigateToView(v as ViewId)}
              onOpenBill={(id) => { setOpenBillId(id); navigateToView('bills') }}
              active={view === 'dashboard'}
            />
          </div>
          {view === 'bills' && (
            <Bills
              openBillId={openBillId}
              onOpenBillConsumed={() => setOpenBillId(null)}
              prefillQuery={prefill?.view === 'bills' ? prefill.q : undefined}
              prefillKey={prefill?.view === 'bills' ? prefill.key : undefined}
              onPrefillConsumed={() => setPrefill(null)}
            />
          )}
          {view === 'inventory' && (
            <Inventory
              prefillQuery={prefill?.view === 'inventory' ? prefill.q : undefined}
              prefillKey={prefill?.view === 'inventory' ? prefill.key : undefined}
              onPrefillConsumed={() => setPrefill(null)}
              section={inventorySection}
            />
          )}
          {view === 'purchases' && (
            <Purchases
              prefillQuery={prefill?.view === 'purchases' ? prefill.q : undefined}
              prefillKey={prefill?.view === 'purchases' ? prefill.key : undefined}
              onPrefillConsumed={() => setPrefill(null)}
            />
          )}
          {view === 'settings'  && <Settings section={settingsSection} onSectionChange={setSettingsSection} />}
          <div
            className="pos-mount"
            style={{ display: isPOS ? 'flex' : 'none' }}
          >
            <POS
              active={isPOS}
              prefillQuery={prefill?.view === 'pos' ? prefill.q : undefined}
              prefillKey={prefill?.view === 'pos' ? prefill.key : undefined}
              onPrefillConsumed={() => setPrefill(null)}
            />
          </div>
        </div>
    </ModuleLayout>
  )
}

export function ERPApp() {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  useTheme()

  if (isLoading) {
    return <BrandedLoader />
  }

  if (!user) return <LoginScreen />

  return (
    <ToastProvider>
      <AppInner key={pathname} />
    </ToastProvider>
  )
}
