'use client'

import { useState, useRef } from 'react'
import { Icon } from './ui'
import { Avatar } from './ui'
import { useAuth } from '@/lib/auth-context'
import { canAccessView, formatRoleLabel } from '@/lib/rbac'
import { MercantileMark } from '@/components/brand/MercantileMark'
import { useClickOutside } from './ui'

export type ViewId = 'dashboard' | 'pos' | 'bills' | 'inventory' | 'purchases' | 'settings'

const NAV = [
  {
    label: 'Operations', items: [
      { id: 'dashboard' as ViewId, label: 'Dashboard', icon: 'layout-dashboard' },
      { id: 'pos' as ViewId, label: 'Billing / POS', icon: 'scan-line' },
      { id: 'bills' as ViewId, label: 'Sales bills', icon: 'receipt' },
      { id: 'inventory' as ViewId, label: 'Inventory', icon: 'boxes', count: 4 },
    ],
  },
  {
    label: 'Procurement', items: [
      { id: 'purchases' as ViewId, label: 'Purchases', icon: 'truck' },
    ],
  },
]

const VIEW_META: Record<ViewId, { title: string; crumb: string }> = {
  dashboard: { title: 'Dashboard', crumb: 'Operations · Overview' },
  pos: { title: 'Billing / POS', crumb: 'Operations · Counter 1' },
  bills: { title: 'Sales bills', crumb: 'Operations · Bill history' },
  inventory: { title: 'Inventory', crumb: 'Operations · Stock' },
  purchases: { title: 'Purchases', crumb: 'Procurement · Supplier Bills' },
  settings: { title: 'Settings', crumb: 'Administration' },
}

export function Sidebar({
  view, setView, collapsed, mobileOpen, onNavigate,
}: {
  view: ViewId
  setView: (v: ViewId) => void
  collapsed: boolean
  mobileOpen?: boolean
  onNavigate?: () => void
}) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen)

  const canSettings = canAccessView(user, 'settings')

  function pickView(next: ViewId) {
    setView(next)
    setMenuOpen(false)
    onNavigate?.()
  }

  function navTo(next: ViewId) {
    setView(next)
    onNavigate?.()
  }

  return (
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '') + (mobileOpen ? ' mobile-open' : '')}>
      <div className="sb-brand">
        <div className="sb-logo">
          <MercantileMark height={16} />
        </div>
        <div className="sb-brand-text">
          <span className="nm font-brand">Mercantile</span>
        </div>
      </div>

      <div className="sb-scroll">
        {NAV.map(sec => {
          const items = sec.items.filter(it => canAccessView(user, it.id))
          if (!items.length) return null
          return (
          <div className="sb-section" key={sec.label}>
            <div className="sb-label">{sec.label}</div>
            {items.map(it => (
              <button
                key={it.id}
                className={'sb-nav' + (view === it.id ? ' active' : '')}
                data-tip={it.label}
                onClick={() => navTo(it.id)}
              >
                <Icon name={it.icon} size={18} className="ic" />
                <span className="sb-txt">{it.label}</span>
                {'count' in it && it.count != null && (
                  <span className="sb-count">{it.count}</span>
                )}
              </button>
            ))}
          </div>
          )
        })}
      </div>

      <div className="sb-foot">
        <div ref={menuRef} className="sb-user-wrap">
          <button
            type="button"
            className={'sb-user' + (menuOpen ? ' open' : '')}
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <Avatar name={user?.name ?? ''} size="sm" />
            <div className="who">
              <div className="n">{user?.name ?? '—'}</div>
              <div className="r">{user?.role ? formatRoleLabel(user.role) : ''}</div>
            </div>
            <Icon name={menuOpen ? 'chevron-down' : 'chevron-up'} size={15} className="chev" />
          </button>

          {menuOpen && (
            <div className="sb-user-menu popover" role="menu">
              <div className="sb-user-menu-head">
                <Avatar name={user?.name ?? ''} size="lg" />
                <div className="who">
                  <div className="n">{user?.name ?? '—'}</div>
                  <div className="e">{user?.email ?? ''}</div>
                  <div className="r">{user?.role ? formatRoleLabel(user.role) : ''}</div>
                </div>
              </div>
              {canSettings && (
                <>
                  <button type="button" className="menu-item" role="menuitem" onClick={() => pickView('settings')}>
                    <Icon name="settings" size={16} className="lead" />
                    Settings
                  </button>
                  <div className="menu-divider" />
                </>
              )}
              <button
                type="button"
                className="menu-item danger"
                role="menuitem"
                onClick={() => { setMenuOpen(false); logout() }}
              >
                <Icon name="log-out" size={16} className="lead" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

import type { Theme } from '@/lib/theme'

export function Topbar({
  view, theme, onToggleTheme, collapsed, setCollapsed, onMobileNav, onCmd,
}: {
  view: ViewId
  theme: Theme
  onToggleTheme: () => void
  collapsed: boolean
  setCollapsed: (fn: (c: boolean) => boolean) => void
  onMobileNav?: () => void
  onCmd: () => void
}) {
  const meta = VIEW_META[view] ?? { title: '', crumb: '' }
  return (
    <header className="topbar">
      <button type="button" className="icon-btn mobile-only" onClick={onMobileNav} aria-label="Open navigation">
        <Icon name="menu" size={18} />
      </button>
      <button type="button" className="icon-btn desktop-only" onClick={() => setCollapsed(c => !c)} aria-label="Toggle sidebar">
        <Icon name={collapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
      </button>
      <div className="tb-title">
        <span className="h">{meta.title}</span>
        <span className="crumb">{meta.crumb}</span>
      </div>
      <div className="spacer" />
      {view !== 'pos' && (
        <button className="cmd-trigger" onClick={onCmd} type="button" aria-label="Open search">
          <Icon name="search" size={15} />
          <span className="cmd-trigger-label">Search products, bills…</span>
        </button>
      )}
      <button className="icon-btn" aria-label="Notifications">
        <Icon name="bell" size={18} /><span className="dot" />
      </button>
      <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
    </header>
  )
}
