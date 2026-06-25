'use client'

import {
  useState, useEffect, useRef, useCallback,
  createContext, useContext, type ReactNode, type CSSProperties,
  type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { LucideProps } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

// ---- Icon ----------------------------------------------------------------

function toPascalCase(name: string): string {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
}

export function Icon({
  name, size = 18, strokeWidth = 2, className = '', style,
}: {
  name: string; size?: number; strokeWidth?: number; className?: string; style?: CSSProperties
}) {
  const key = toPascalCase(name)
  const IconComp = (LucideIcons as unknown as Record<string, React.FC<LucideProps>>)[key]
  if (!IconComp) return null
  return <IconComp className={'ic ' + className} size={size} strokeWidth={strokeWidth} style={style} />
}

// ---- Button --------------------------------------------------------------

export function Button({
  variant = 'outline', size: sz, icon, iconRight, children,
  className = '', style, ...rest
}: {
  variant?: string; size?: string; icon?: string; iconRight?: string;
  children?: ReactNode; className?: string; style?: CSSProperties;
  [k: string]: unknown
}) {
  const cls = ['btn', variant, sz, !children ? 'icon' : '', className].filter(Boolean).join(' ')
  const isz = sz === 'sm' ? 14 : 16
  return (
    <button className={cls} style={style as CSSProperties} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {icon && <Icon name={icon} size={isz} />}
      {children}
      {iconRight && <Icon name={iconRight} size={isz} />}
    </button>
  )
}

// ---- Badge ---------------------------------------------------------------

export function Badge({
  tone = 'neutral', dot, icon, children, className = '',
}: {
  tone?: string; dot?: boolean; icon?: string; children?: ReactNode; className?: string
}) {
  return (
    <span className={'badge ' + tone + ' ' + className}>
      {dot && <span className="bdot" />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

// ---- Avatar --------------------------------------------------------------

export function Avatar({ name = '', size = '' }: { name?: string; size?: string }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return <span className={'avatar ' + size}>{initials || '?'}</span>
}

// ---- Checkbox ------------------------------------------------------------

export function Checkbox({ checked, onChange }: { checked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={'ckbox' + (checked ? ' on' : '')}
      onClick={(e) => { e.stopPropagation(); onChange?.(!checked) }}
      aria-checked={checked}
      role="checkbox"
    >
      <Icon name="check" size={11} strokeWidth={3.5} />
    </button>
  )
}

// ---- Switch --------------------------------------------------------------

export function Switch({ checked, onChange, disabled = false }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      className={'switch' + (checked ? ' on' : '') + (disabled ? ' disabled' : '')}
      onClick={() => !disabled && onChange?.(!checked)}
    />
  )
}

// ---- Click outside hook --------------------------------------------------

export function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onOut() }
    function k(e: KeyboardEvent) { if (e.key === 'Escape') onOut() }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [active, ref, onOut])
}

// ---- Field ---------------------------------------------------------------

export function Field({
  label, required, optional, hint, error, children,
}: {
  label?: string; required?: boolean; optional?: boolean;
  hint?: string; error?: string | null; children?: ReactNode
}) {
  return (
    <div className="field">
      {label && (
        <label>
          {label}
          {required && <span className="req"> *</span>}
          {optional && <span className="subtle" style={{ fontWeight: 500 }}> (optional)</span>}
        </label>
      )}
      {children}
      {error
        ? <span className="err"><Icon name="alert-circle" size={12} />{error}</span>
        : hint && <span className="hint">{hint}</span>}
    </div>
  )
}

// ---- TextInput -----------------------------------------------------------

export function TextInput({
  value, onChange, placeholder, icon, size: sz, type = 'text',
  error, filled, pill, suffix, autoFocus, ...rest
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  icon?: string; size?: string; type?: string; error?: boolean;
  filled?: boolean; pill?: boolean; suffix?: ReactNode; autoFocus?: boolean;
  [k: string]: unknown
}) {
  return (
    <div className={['input', sz === 'sm' ? 'sm' : '', error ? 'error' : '', filled ? 'filled' : '', pill ? 'pill' : ''].filter(Boolean).join(' ')}>
      {icon && <Icon name={icon} size={sz === 'sm' ? 14 : 16} />}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
        {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
      />
      {suffix}
    </div>
  )
}

// ---- Select option types -------------------------------------------------

export interface SelectOption {
  value: string; label: string; sub?: string; icon?: string; danger?: boolean
}
export interface SelectGroup {
  label: string; items: SelectOption[]
}

// ---- MItem (helper) ------------------------------------------------------

function MItem({ it, value, onChange, setOpen }: {
  it: SelectOption; value: string; onChange?: (v: string) => void; setOpen: (v: boolean) => void
}) {
  return (
    <button
      className={'menu-item' + (it.value === value ? ' active' : '') + (it.danger ? ' danger' : '')}
      onClick={() => { onChange?.(it.value); setOpen(false) }}
    >
      {it.icon && <Icon name={it.icon} size={16} className="lead" />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
        {it.sub && <span className="td-sub" style={{ display: 'block' }}>{it.sub}</span>}
      </span>
      {it.value === value && <Icon name="check" size={15} className="check" />}
    </button>
  )
}

// ---- Select --------------------------------------------------------------

export function Select({
  value, onChange, options, placeholder = 'Select…', size: sz, icon,
  width, align = 'left', disabled = false,
}: {
  value: string; onChange?: (v: string) => void; options: (SelectOption | SelectGroup)[];
  placeholder?: string; size?: string; icon?: string; width?: number | string;
  align?: 'left' | 'right'; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useClickOutside(wrap, () => setOpen(false), open)

  const flat: SelectOption[] = []
  options.forEach(o => {
    if ('items' in o) o.items.forEach(i => flat.push(i))
    else flat.push(o)
  })
  const sel = flat.find(o => o.value === value)

  return (
    <div ref={wrap} style={{ position: 'relative', width: width ?? '100%', opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      <div
        className={'select-trigger' + (sz === 'sm' ? ' sm' : '') + (open ? ' open' : '')}
        onClick={() => !disabled && setOpen(v => !v)}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        {(icon || (sel?.icon)) && <Icon name={icon ?? sel!.icon!} size={sz === 'sm' ? 14 : 16} style={{ color: 'var(--fg-muted)' }} />}
        <span className={'val' + (sel ? '' : ' ph')}>{sel ? sel.label : placeholder}</span>
        <Icon name="chevron-down" size={15} className="chev" />
      </div>
      {open && (
        <div className="popover" style={{ position: 'absolute', top: 'calc(100% + 5px)', [align]: 0, minWidth: '100%' }}>
          {options.map((o, i) =>
            'items' in o ? (
              <div key={i}>
                <div className="menu-label">{o.label}</div>
                {o.items.map(it => <MItem key={it.value} it={it} value={value} onChange={onChange} setOpen={setOpen} />)}
              </div>
            ) : <MItem key={o.value} it={o} value={value} onChange={onChange} setOpen={setOpen} />
          )}
        </div>
      )}
    </div>
  )
}

// ---- Segmented -----------------------------------------------------------

export function Segmented({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string; icon?: string }[]
}) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={14} />}{o.label}
        </button>
      ))}
    </div>
  )
}

// ---- Tabs ----------------------------------------------------------------

export function Tabs({
  value, onChange, tabs,
}: {
  value: string; onChange: (v: string) => void; tabs: { value: string; label: string }[]
}) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.value} className={value === t.value ? 'on' : ''} onClick={() => onChange(t.value)}>{t.label}</button>
      ))}
    </div>
  )
}

// ---- Modal ---------------------------------------------------------------

export function Modal({
  title, sub, icon, iconTone = 'tile-primary', wide, onClose, children, footer,
}: {
  title: string; sub?: string; icon?: string; iconTone?: string; wide?: boolean;
  onClose: () => void; children?: ReactNode; footer?: ReactNode
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={'modal' + (wide ? ' wide' : '')}>
        <div className="modal-head">
          {icon && <IconTile tone={iconTone} size={36} icon={icon} />}
          <div style={{ flex: 1 }}>
            <div className="mt">{title}</div>
            {sub && <div className="ms">{sub}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

// ---- Drawer --------------------------------------------------------------

export function Drawer({
  title, sub, onClose, children,
}: {
  title: string; sub?: string; onClose: () => void; children?: ReactNode
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  return createPortal(
    <div className="drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="drawer">
        <div className="drawer-head">
          <div style={{ flex: 1 }}>
            <div className="mt" style={{ fontSize: 16, fontWeight: 650 }}>{title}</div>
            {sub && <div className="ms" style={{ fontSize: 12.5, color: 'var(--fg-subtle)' }}>{sub}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}

// ---- Toasts --------------------------------------------------------------

interface ToastItem { id: string; msg: string; icon?: string; tone?: string }
type ToastFn = (msg: string, opts?: { icon?: string; tone?: string; duration?: number }) => void

const ToastCtx = createContext<ToastFn | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const push = useCallback<ToastFn>((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, msg, ...opts }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts.duration ?? 2600)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {mounted && createPortal(
        <div className="toast-wrap">
          {toasts.map(t => (
            <div className="toast" key={t.id}>
              <Icon name={t.icon ?? 'check-circle-2'} size={16} className={'tk-ic ' + (t.tone ?? 'ok')} />
              {t.msg}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

// ---- IconTile ------------------------------------------------------------

export function IconTile({
  tone = 'tile-primary', size = 32, icon, iconSize, children, className = '',
}: {
  tone?: string; size?: number; icon?: string; iconSize?: number;
  children?: ReactNode; className?: string;
}) {
  return (
    <div
      className={'kpi-ic ' + tone + (className ? ' ' + className : '')}
      style={{ width: size, height: size }}
    >
      {icon ? <Icon name={icon} size={iconSize ?? Math.round(size / 2)} /> : children}
    </div>
  )
}

// ---- KpiCard -------------------------------------------------------------

export function KpiCard({
  label, value, icon, tone = 'tile-primary', trend, trendDir, vs,
}: {
  label: string; value: string | number; icon: string; tone?: string;
  trend?: string; trendDir?: 'up' | 'down'; vs?: string
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <IconTile tone={tone} size={32} icon={icon} iconSize={17} />
        <div className="kpi-label">{label}</div>
      </div>
      <div className="kpi-val tnum">{value}</div>
      <div className="kpi-foot">
        {trend != null && (
          <span className={'trend ' + (trendDir ?? 'up')}>
            <Icon name={trendDir === 'down' ? 'trending-down' : 'trending-up'} size={13} />{trend}
          </span>
        )}
        {vs && <span className="vs">{vs}</span>}
      </div>
    </div>
  )
}

// ---- Card ----------------------------------------------------------------

export function Card({
  title, sub, action, children, bodyStyle, noBody, className = '',
}: {
  title?: string; sub?: string; action?: ReactNode; children?: ReactNode;
  bodyStyle?: CSSProperties; noBody?: boolean; className?: string
}) {
  return (
    <div className={'card ' + className}>
      {(title || action) && (
        <div className="card-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <div className="ct">{title}</div>}
            {sub && <div className="cs">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      {noBody ? children : <div className="card-body" style={bodyStyle}>{children}</div>}
    </div>
  )
}

export { ContentLoader } from './branded-loader'
