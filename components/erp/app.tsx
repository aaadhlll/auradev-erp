'use client'

import { useState, useEffect, useRef } from 'react'
import { ToastProvider, useToast } from './ui'
import { Sidebar, Topbar, type ViewId } from './shell'
import { GlobalSearch, type GlobalSearchSelect } from './global-search'
import { Dashboard } from './dashboard'
import { POS } from './pos'
import { Inventory } from './inventory'
import { Purchases } from './purchases'
import { Bills } from './bills'
import { Settings } from './settings'
import { LoginScreen } from './login'
import { BrandedLoader } from './branded-loader'
import { useAuth } from '@/lib/auth-context'
import { canAccessView, firstAccessibleView } from '@/lib/rbac'
import { useTheme } from '@/lib/theme'

const SPLASH_MS = 2500

function AppInner() {
  const toast = useToast()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<ViewId>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [prefill, setPrefill] = useState<{ view: ViewId; q: string; key: number } | null>(null)
  const [openBillId, setOpenBillId] = useState<string | null>(null)

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
    if (user && !canAccessView(user, view)) {
      setView(firstAccessibleView(user))
    }
  }, [user, view])

  function handleSearchSelect(sel: GlobalSearchSelect) {
    setView(sel.view)
    if (sel.billId) {
      setOpenBillId(sel.billId)
      return
    }
    if (sel.query) setPrefill({ view: sel.view, q: sel.query, key: Date.now() })
  }

  const isPOS = view === 'pos'

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} collapsed={collapsed} />
      <div className="main">
        <Topbar
          view={view}
          theme={theme}
          onToggleTheme={toggleTheme}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onCmd={() => setSearchOpen(true)}
        />
        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSearchSelect}
        />
        <div className={'content' + (isPOS ? ' pos-mode' : '')}>
          <div className="dashboard-mount" style={{ display: view === 'dashboard' ? 'block' : 'none' }}>
            <Dashboard
              setView={(v) => setView(v as ViewId)}
              onOpenBill={(id) => { setOpenBillId(id); setView('bills') }}
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
            />
          )}
          {view === 'purchases' && (
            <Purchases
              prefillQuery={prefill?.view === 'purchases' ? prefill.q : undefined}
              prefillKey={prefill?.view === 'purchases' ? prefill.key : undefined}
              onPrefillConsumed={() => setPrefill(null)}
            />
          )}
          {view === 'settings'  && <Settings />}
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
      </div>
    </div>
  )
}

export function ERPApp() {
  const { user, isLoading } = useAuth()
  useTheme()
  const [splash, setSplash] = useState(true)
  const splashAt = useRef(Date.now())
  const wasLoggedOut = useRef(false)

  useEffect(() => {
    if (isLoading) {
      setSplash(true)
      splashAt.current = Date.now()
      return
    }

    if (!user) {
      wasLoggedOut.current = true
      setSplash(false)
      return
    }

    if (wasLoggedOut.current) {
      wasLoggedOut.current = false
      splashAt.current = Date.now()
      setSplash(true)
      const t = setTimeout(() => setSplash(false), SPLASH_MS)
      return () => clearTimeout(t)
    }

    const remaining = Math.max(0, SPLASH_MS - (Date.now() - splashAt.current))
    setSplash(true)
    const t = setTimeout(() => setSplash(false), remaining)
    return () => clearTimeout(t)
  }, [isLoading, user])

  if (isLoading || (user && splash)) {
    return <BrandedLoader />
  }

  if (!user) return <LoginScreen />

  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
