'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './ui'
import {
  runGlobalSearch,
  filterSearchResults,
  searchPages,
  SEARCH_GROUP_LABEL,
  SEARCH_GROUP_ORDER,
  type SearchResult,
  type SearchResultKind,
} from '@/lib/global-search'
import type { ViewId } from './shell'
import { useAuth } from '@/lib/auth-context'

export interface GlobalSearchSelect {
  view: ViewId
  query?: string
  billId?: string
}

function groupResults(results: SearchResult[]): [SearchResultKind, SearchResult[]][] {
  const map = new Map<SearchResultKind, SearchResult[]>()
  for (const r of results) {
    const list = map.get(r.kind) ?? []
    list.push(r)
    map.set(r.kind, list)
  }
  return SEARCH_GROUP_ORDER.filter(k => map.has(k)).map(k => [k, map.get(k)!])
}

export function GlobalSearch({
  open, onClose, onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (sel: GlobalSearchSelect) => void
}) {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const flatResults = useMemo(() => {
    const flat: SearchResult[] = []
    for (const [, items] of groupResults(results)) flat.push(...items)
    return flat
  }, [results])

  useEffect(() => {
    if (!open) return
    setQ('')
    setError(null)
    setActive(0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await runGlobalSearch(q, user)
        if (!cancelled) {
          setResults(r)
          setActive(0)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Search failed')
          setResults(filterSearchResults(user, q.trim() ? searchPages(q) : searchPages('')))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, q.trim() ? 200 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q, open, user])

  const pick = useCallback((r: SearchResult) => {
    onSelect({ view: r.view, query: r.query, billId: r.billId })
    onClose()
  }, [onSelect, onClose])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(a => Math.min(a + 1, Math.max(0, flatResults.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && flatResults[active]) {
      e.preventDefault()
      pick(flatResults[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const groups = groupResults(results)
  let idx = 0

  return createPortal(
    <div className="cmd-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cmd-palette" role="dialog" aria-label="Global search" onMouseDown={e => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            className="cmd-input"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search products, bills, pages…"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Icon name="loader" size={16} className="cmd-spin" />}
          <kbd className="kbd">Esc</kbd>
        </div>

        <div className="cmd-list" ref={listRef}>
          {error && (
            <div className="cmd-hint warn">
              <Icon name="alert-circle" size={14} />
              {error} — showing pages only
            </div>
          )}
          {flatResults.length === 0 && q.trim() && !loading ? (
            <div className="cmd-empty">
              <Icon name="search-x" size={20} />
              <span>No results for &ldquo;{q}&rdquo;</span>
            </div>
          ) : (
            groups.map(([kind, items]) => (
              <div className="cmd-group" key={kind}>
                <div className="cmd-group-label">{SEARCH_GROUP_LABEL[kind]}</div>
                {items.map(r => {
                  const i = idx++
                  return (
                    <button
                      key={r.id}
                      type="button"
                      data-idx={i}
                      className={'cmd-item' + (active === i ? ' active' : '')}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(r)}
                    >
                      <span className="cmd-item-icon">
                        <Icon name={r.icon} size={16} />
                      </span>
                      <span className="cmd-item-text">
                        <span className="cmd-item-label">{r.label}</span>
                        <span className="cmd-item-sub">{r.sub}</span>
                      </span>
                      <Icon name="corner-down-left" size={14} className="cmd-enter" />
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmd-foot">
          <span><kbd className="kbd">↑↓</kbd> navigate</span>
          <span><kbd className="kbd">↵</kbd> open</span>
          <span><kbd className="kbd">esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
