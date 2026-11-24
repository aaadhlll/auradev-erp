'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Icon, Modal, ToastProvider } from './ui'
import { Sidebar, Topbar, type ViewId } from './shell'
import { GlobalSearch, type GlobalSearchSelect } from './global-search'
import { Dashboard } from './dashboard'
import { POS } from './pos'
import { Inventory, type InventorySectionId } from './inventory'
import { Purchases, type ProcurementSectionId } from './purchases'
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

const INVENTORY_SECTION_STORAGE_KEY = 'mercantile.inventory.section'
const PROCUREMENT_SECTION_STORAGE_KEY = 'mercantile.procurement.section'

function viewForLocation(pathname: string, requestedView: string | null): ViewId {
  const routeModule = moduleForRoute(pathname)
  if (requestedView && routeModule?.views.includes(requestedView as ViewId)) return requestedView as ViewId
  return routeModule?.defaultView ?? 'dashboard'
}

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const groups = [
    { title: 'Navigate', rows: [['Alt + 1', 'Overview dashboard'], ['Alt + 2', 'Point of Sale'], ['Alt + 3', 'Sales bills'], ['Alt + 4', 'Inventory'], ['Alt + 5', 'Procurement'], ['Alt + 6', 'Administration']] },
    { title: 'Find & help', rows: [['Ctrl / ⌘ + K', 'Search pages, products and bills'], ['F1', 'Open this shortcut guide'], ['Esc', 'Close the active dialog or menu']] },
    { title: 'Point of Sale', rows: [['F2', 'Clear the current cart'], ['F4', 'Park the current cart'], ['F6', 'Open parked bills'], ['F8', 'Open payment for the current cart'], ['Enter', 'Add the first matching barcode/search result']] },
  ]
  return <Modal title="Keyboard shortcuts" sub="Quick actions designed for faster counter and back-office work" icon="keyboard" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {groups.map(group => <div key={group.title} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}><div style={{ padding: '10px 12px', fontWeight: 700, background: 'var(--surface-subtle)' }}>{group.title}</div><div style={{ padding: '3px 12px' }}>{group.rows.map(([key, description]) => <div className="row" key={key} style={{ justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}><span className="muted" style={{ fontSize: 12.5 }}>{description}</span><kbd className="kbd" style={{ whiteSpace: 'nowrap' }}>{key}</kbd></div>)}</div></div>)}
    </div>
    <div className="row gap8 muted" style={{ fontSize: 12, marginTop: 14 }}><Icon name="info" size={14} />Shortcuts do not run while you are typing in a form field.</div>
  </Modal>
}

function AppInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<ViewId>(() => viewForLocation(pathname, searchParams.get('view')))
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [prefill, setPrefill] = useState<{ view: ViewId; q: string; key: number } | null>(null)
  const [openBillId, setOpenBillId] = useState<string | null>(() => searchParams.get('billId'))
  const [openPurchaseId, setOpenPurchaseId] = useState<string | null>(null)
  const [billCustomerFilter, setBillCustomerFilter] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get('customerId')
    const name = searchParams.get('customerName')
    return id && name ? { id, name } : null
  })
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('store')
  // Inventory and Procurement intentionally open as an empty workspace. A page
  // is mounted only after the user chooses an item from that module's sidebar.
  const [inventorySection, setInventorySection] = useState<InventorySectionId | null>(null)
  const [procurementSection, setProcurementSection] = useState<ProcurementSectionId | null>(null)

  // A module still opens blank on its first visit. Once a page is chosen, keep
  // that choice for this browser tab so a refresh returns to the same page.
  useEffect(() => {
    const routeModule = moduleForRoute(pathname)
    if (routeModule?.id === 'inventory') {
      const savedSection = window.sessionStorage.getItem(INVENTORY_SECTION_STORAGE_KEY) as InventorySectionId | null
      if (savedSection) setInventorySection(savedSection)
    }
    if (routeModule?.id === 'procurement') {
      const savedSection = window.sessionStorage.getItem(PROCUREMENT_SECTION_STORAGE_KEY) as ProcurementSectionId | null
      if (savedSection) setProcurementSection(savedSection)
    }
  }, [pathname])

  function chooseInventorySection(section: InventorySectionId | null) {
    if (section) window.sessionStorage.setItem(INVENTORY_SECTION_STORAGE_KEY, section)
    setInventorySection(section)
  }

  function chooseProcurementSection(section: ProcurementSectionId | null) {
    if (section) window.sessionStorage.setItem(PROCUREMENT_SECTION_STORAGE_KEY, section)
    setProcurementSection(section)
  }

  useEffect(() => {
    const routeModule = moduleForRoute(pathname)
    if (!routeModule || !user) return
    if (canAccessView(user, routeModule.defaultView)) return
    const fallback = firstAccessibleView(user)
    router.replace(moduleForView(fallback).route)
  }, [pathname, router, user])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'))
      if (!typing && e.key === 'F1') {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (!typing && e.altKey && !e.ctrlKey && !e.metaKey) {
        const targetView = ({ '1': 'dashboard', '2': 'pos', '3': 'bills', '4': 'inventory', '5': 'purchases', '6': 'settings' } as Record<string, ViewId | undefined>)[e.key]
        if (targetView && user && canAccessView(user, targetView)) {
          e.preventDefault()
          navigateToView(targetView)
          return
        }
      }
      if (view === 'pos') return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view, user])

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
    navigateToView(sel.view)
    // Search is an explicit destination, so it may open the relevant workspace.
    if (sel.view === 'inventory') chooseInventorySection('items')
    if (sel.billId) {
      setOpenBillId(sel.billId)
      return
    }
    if (sel.query) setPrefill({ view: sel.view, q: sel.query, key: Date.now() })
  }

  function navigateToView(next: ViewId) {
    const routeModule = moduleForRoute(pathname)
    if (next === 'inventory' && routeModule?.id !== 'inventory') setInventorySection(null)
    if (next === 'purchases' && routeModule?.id !== 'procurement') setProcurementSection(null)
    if (next === 'suppliers') chooseProcurementSection('suppliers')
    setView(next)
    const nextModule = moduleForView(next)
    if (routeModule?.id !== nextModule.id) {
      const suffix = nextModule.defaultView === next ? '' : `?view=${encodeURIComponent(next)}`
      router.push(`${nextModule.route}${suffix}`)
    }
  }

  function openCustomerBills(customerId: string, customerName: string) {
    setBillCustomerFilter({ id: customerId, name: customerName })
    setView('bills')
    const target = moduleForView('bills')
    const params = new URLSearchParams({ view: 'bills', customerId, customerName })
    router.push(`${target.route}?${params.toString()}`)
  }

  function openBillFromDashboard(billId: string) {
    setBillCustomerFilter(null)
    setOpenBillId(billId)
    setView('bills')
    const target = moduleForView('bills')
    const params = new URLSearchParams({ view: 'bills', billId })
    router.push(`${target.route}?${params.toString()}`)
  }

  function clearBillCustomerFilter() {
    setBillCustomerFilter(null)
    router.replace(`${moduleForView('bills').route}?view=bills`)
  }

  function openNotificationTarget(section: ProcurementSectionId, purchaseId?: string) {
    navigateToView('purchases')
    chooseProcurementSection(section)
    setOpenPurchaseId(purchaseId ?? null)
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
        onLogout={() => router.replace('/home')}
        settingsSection={settingsSection}
        onSettingsSectionChange={setSettingsSection}
        inventorySection={inventorySection}
        onInventorySectionChange={chooseInventorySection}
        procurementSection={procurementSection}
        onProcurementSectionChange={chooseProcurementSection}
      />}
      topbar={<Topbar
          view={view}
          theme={theme}
          onToggleTheme={toggleTheme}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onMobileNav={() => setMobileNavOpen(o => !o)}
          onCmd={() => setSearchOpen(true)}
          onNotificationNavigate={openNotificationTarget}
        />}
    >
        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSearchSelect}
        />
        {shortcutsOpen && <KeyboardShortcutsModal onClose={() => setShortcutsOpen(false)} />}
        <div className={'content' + (isPOS ? ' pos-mode' : '')}>
          <div className="dashboard-mount" style={{ display: view === 'dashboard' ? 'block' : 'none' }}>
            <Dashboard
              setView={(v) => navigateToView(v as ViewId)}
              onOpenBill={openBillFromDashboard}
              onOpenBills={() => { setBillCustomerFilter(null); navigateToView('bills') }}
              onOpenCustomerBills={openCustomerBills}
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
              customerFilter={billCustomerFilter}
              onClearCustomerFilter={clearBillCustomerFilter}
            />
          )}
          {view === 'inventory' && inventorySection && (
            <Inventory
              prefillQuery={prefill?.view === 'inventory' ? prefill.q : undefined}
              prefillKey={prefill?.view === 'inventory' ? prefill.key : undefined}
              onPrefillConsumed={() => setPrefill(null)}
              section={inventorySection}
            />
          )}
          {(view === 'suppliers' || (view === 'purchases' && procurementSection)) && (
            <Purchases
              prefillQuery={prefill?.view === 'purchases' ? prefill.q : undefined}
              prefillKey={prefill?.view === 'purchases' ? prefill.key : undefined}
              onPrefillConsumed={() => setPrefill(null)}
              section={view === 'suppliers' ? 'suppliers' : procurementSection!}
              openPurchaseId={openPurchaseId}
              onOpenPurchaseConsumed={() => setOpenPurchaseId(null)}
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
