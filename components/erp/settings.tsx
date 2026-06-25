'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon, Button, Badge, Avatar, Field, TextInput, Select, Segmented, Switch, Modal, Card, IconTile, useToast } from './ui'
import { updateStoreProfile, uploadStoreLogo, resolveLogoUrl, updatePrinterSettings, updateBillingSettings } from '@/lib/settings-api'
import {
  useStoreProfileQuery,
  useInvalidateStoreProfile,
  usePrinterSettingsQuery,
  useInvalidatePrinterSettings,
  useBillingSettingsQuery,
  useInvalidateBillingSettings,
} from '@/lib/queries/use-settings'
import { formatRoleLabel, canAccessSettingsSection, canEditSettingsSection, type SettingsSectionId } from '@/lib/rbac'
import { useAuditLogQuery } from '@/lib/queries/use-audit'
import { formatAuditAction, formatAuditTime } from '@/lib/audit-api'
import { useUsersQuery, useInvalidateUsers } from '@/lib/queries/use-users'
import {
  createUser, updateUser, ASSIGNABLE_ROLES, formatLastLogin,
  type TenantUser, type UserRole, type UserStatus,
} from '@/lib/users-api'
import { useAuth } from '@/lib/auth-context'

const SETTINGS_NAV: { id: SettingsSectionId; label: string; icon: string }[] = [
  { id: 'store', label: 'Store Profile', icon: 'store' },
  { id: 'billing', label: 'Billing & POS', icon: 'scan-line' },
  { id: 'printer', label: 'Printer Settings', icon: 'printer' },
  { id: 'users', label: 'User Management', icon: 'users' },
  { id: 'audit', label: 'Audit Log', icon: 'scroll-text' },
]

function SaveBar({ onSave, onReset, saving }: { onSave: () => void; onReset: () => void; saving?: boolean }) {
  return (
    <div className="row gap10" style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
      <Button variant="ghost" onClick={onReset} disabled={saving}>Cancel</Button>
      <Button variant="primary" icon="check" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
    </div>
  )
}

function StoreProfile() {
  const toast = useToast()
  const { user } = useAuth()
  const canEdit = canEditSettingsSection(user, 'store')
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: profile, isLoading, error } = useStoreProfileQuery()
  const invalidate = useInvalidateStoreProfile()
  const [f, setF] = useState({
    name: '',
    phone: '',
    gstin: '',
    addr: '',
    prefix: '',
    footer: '',
    stateCode: '29',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = (k: string) => (v: string) => setF(s => ({ ...s, [k]: v }))

  useEffect(() => {
    if (!profile) return
    setF({
      name: profile.name,
      phone: profile.phone ?? '',
      gstin: profile.gstin ?? '',
      addr: profile.address ?? '',
      prefix: profile.billNoPrefix,
      footer: profile.billFooter ?? '',
      stateCode: profile.stateCode,
    })
  }, [profile])

  async function save() {
    if (!canEdit) return
    if (!f.name.trim() || !f.prefix.trim()) {
      toast('Store name and bill prefix are required', { tone: 'danger' })
      return
    }
    setSaving(true)
    try {
      await updateStoreProfile({
        name: f.name.trim(),
        phone: f.phone.trim() || undefined,
        gstin: f.gstin.trim() || undefined,
        address: f.addr.trim() || undefined,
        billNoPrefix: f.prefix.trim(),
        billFooter: f.footer.trim() || undefined,
        stateCode: f.stateCode.trim() || undefined,
      })
      invalidate()
      toast('Store profile saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save profile', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  async function onLogoPick(file: File | undefined) {
    if (!file || !canEdit) return
    setUploading(true)
    try {
      await uploadStoreLogo(file)
      invalidate()
      toast('Logo updated — it will appear on new receipts')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Logo upload failed', { tone: 'danger' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const logoSrc = resolveLogoUrl(profile?.logoUrl ?? null)

  return (
    <Card title="Store Profile" sub="Appears on every printed bill and customer-facing surface">
      {isLoading && <p className="muted">Loading profile…</p>}
      {error && <p className="muted" style={{ color: 'var(--danger)' }}>Could not load store profile.</p>}
      <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => canEdit && fileRef.current?.click()}
          disabled={uploading || !canEdit}
          style={{
            width: 88, height: 88, borderRadius: 'var(--r-lg)', border: '1.5px dashed var(--border-strong)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 5, color: 'var(--fg-subtle)', flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
            background: 'var(--surface-2)', padding: 0,
          }}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="Store logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <><Icon name="image-plus" size={20} /><span style={{ fontSize: 10.5, fontWeight: 600 }}>Logo</span></>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => void onLogoPick(e.target.files?.[0])} />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}><Field label="Store name" required><TextInput value={f.name} onChange={set('name')} disabled={!canEdit} /></Field></div>
          <Field label="Phone"><TextInput value={f.phone} onChange={set('phone')} icon="phone" disabled={!canEdit} /></Field>
          <Field label="GSTIN"><TextInput value={f.gstin} onChange={set('gstin')} disabled={!canEdit} /></Field>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <Field label="Address">
            <div className="input" style={{ height: 'auto' }}>
              <textarea className="bare" value={f.addr} onChange={e => set('addr')(e.target.value)} disabled={!canEdit} />
            </div>
          </Field>
        </div>
        <Field label="Bill number prefix" hint="Bills format as NJK-2025-00001"><TextInput value={f.prefix} onChange={set('prefix')} disabled={!canEdit} /></Field>
        <Field label="Bill footer message"><TextInput value={f.footer} onChange={set('footer')} disabled={!canEdit} /></Field>
      </div>
      {canEdit ? (
      <SaveBar
        onSave={() => void save()}
        onReset={() => profile && setF({
          name: profile.name,
          phone: profile.phone ?? '',
          gstin: profile.gstin ?? '',
          addr: profile.address ?? '',
          prefix: profile.billNoPrefix,
          footer: profile.billFooter ?? '',
          stateCode: profile.stateCode,
        })}
        saving={saving}
      />
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>Read-only — contact a tenant admin to edit store profile.</p>
      )}
    </Card>
  )
}

function AddUserModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (payload: { name: string; email: string; role: UserRole; password: string }) => Promise<void>
}) {
  const [f, setF] = useState({ name: '', email: '', role: 'CASHIER' as UserRole, password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (v: string) => setF(s => ({ ...s, [k]: v }))

  return (
    <Modal title="Add user" sub="Create an account — share the password so they can sign in" icon="user-plus" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" icon="user-plus" disabled={!f.name || !f.email || f.password.length < 8 || busy}
          onClick={() => {
            setBusy(true)
            void onSave({ ...f }).finally(() => setBusy(false))
          }}>
          {busy ? 'Creating…' : 'Create user'}
        </Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Full name" required><TextInput value={f.name} onChange={set('name')} placeholder="e.g. Ravi Shenoy" icon="user-round" /></Field>
        <Field label="Email" required><TextInput value={f.email} onChange={set('email')} placeholder="name@nenjankod.in" icon="mail" type="email" /></Field>
        <Field label="Role">
          <Select value={f.role} onChange={v => set('role')(v)} options={ASSIGNABLE_ROLES.map(r => ({ value: r.value, label: r.label }))} />
        </Field>
        <Field label="Temporary password" required hint="Minimum 8 characters — user signs in with email + this password">
          <TextInput value={f.password} onChange={set('password')} type="password" icon="key-round" />
        </Field>
      </div>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onSave }: {
  user: TenantUser
  onClose: () => void
  onSave: (payload: { name?: string; role?: UserRole; status?: UserStatus; password?: string }) => Promise<void>
}) {
  const { user: me } = useAuth()
  const [f, setF] = useState({
    name: user.name,
    role: user.role,
    status: user.status,
    password: '',
  })
  const [busy, setBusy] = useState(false)
  const isSelf = me?.id === user.id

  return (
    <Modal title="Edit user" sub={user.email} icon="user-cog" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" icon="check" disabled={busy || !f.name.trim()}
          onClick={() => {
            setBusy(true)
            void onSave({
              name: f.name.trim(),
              role: f.role,
              status: f.status,
              password: f.password.trim() || undefined,
            }).finally(() => setBusy(false))
          }}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Full name" required><TextInput value={f.name} onChange={v => setF(s => ({ ...s, name: v }))} /></Field>
        <Field label="Role">
          <Select value={f.role} onChange={v => setF(s => ({ ...s, role: v as UserRole }))} disabled={isSelf}
            options={ASSIGNABLE_ROLES.map(r => ({ value: r.value, label: r.label }))} />
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={v => setF(s => ({ ...s, status: v as UserStatus }))} disabled={isSelf}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
        </Field>
        <Field label="Reset password" hint="Leave blank to keep current password">
          <TextInput value={f.password} onChange={v => setF(s => ({ ...s, password: v }))} type="password" icon="key-round" />
        </Field>
      </div>
    </Modal>
  )
}

function UserManagement() {
  const toast = useToast()
  const { data: users = [], isLoading, error } = useUsersQuery()
  const invalidate = useInvalidateUsers()
  const [open, setOpen] = useState(false)
  const [editUser, setEditUser] = useState<TenantUser | null>(null)
  const roleTone: Record<string, string> = {
    TENANT_ADMIN: 'primary', MANAGER: 'info', CASHIER: 'neutral', INVENTORY_STAFF: 'success', ACCOUNTANT: 'warning',
  }

  async function handleCreate(payload: { name: string; email: string; role: UserRole; password: string }) {
    try {
      await createUser(payload)
      invalidate()
      setOpen(false)
      toast(`Created ${payload.name} — they can sign in with their email and password`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create user', { tone: 'danger' })
      throw e
    }
  }

  async function handleUpdate(payload: { name?: string; role?: UserRole; status?: UserStatus; password?: string }) {
    if (!editUser) return
    try {
      await updateUser(editUser.id, payload)
      invalidate()
      setEditUser(null)
      toast('User updated')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update user', { tone: 'danger' })
      throw e
    }
  }

  return (
    <Card title="User Management" sub={`${users.length} team member${users.length === 1 ? '' : 's'}`} action={<Button size="sm" variant="primary" icon="user-plus" onClick={() => setOpen(true)}>Add user</Button>} noBody>
      {isLoading && <div style={{ padding: 16 }} className="muted">Loading users…</div>}
      {error && <div style={{ padding: 16, color: 'var(--danger)' }}>Could not load users.</div>}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last login</th><th style={{ width: 44 }}></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="row gap10">
                    <Avatar name={u.name} size="sm" />
                    <div className="cell-stack"><span className="td-strong">{u.name}</span><span className="td-sub">{u.email}</span></div>
                  </div>
                </td>
                <td><Badge tone={roleTone[u.role] ?? 'neutral'}>{formatRoleLabel(u.role)}</Badge></td>
                <td><Badge tone={u.status === 'ACTIVE' ? 'success' : 'neutral'} dot>{u.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge></td>
                <td className="muted">{formatLastLogin(u.lastLoginAt)}</td>
                <td>
                  <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setEditUser(u)}>
                    <Icon name="pencil" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <AddUserModal onClose={() => setOpen(false)} onSave={handleCreate} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSave={handleUpdate} />}
    </Card>
  )
}

function BillingSettings() {
  const toast = useToast()
  const { user } = useAuth()
  const canEdit = canEditSettingsSection(user, 'billing')
  const { data: settings, isLoading, error } = useBillingSettingsQuery()
  const invalidate = useInvalidateBillingSettings()
  const [f, setF] = useState({
    maxLineDiscountPercent: '10',
    maxBillDiscountPercent: '15',
    cashierMaxBillDiscountPercent: '5',
    allowHoldBill: true,
    allowCreditSales: true,
    showCashierOnReceipt: true,
    showGstBreakupOnReceipt: true,
    showCustomerOnReceipt: true,
    roundTotalToRupee: false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setF({
      maxLineDiscountPercent: String(settings.maxLineDiscountPercent),
      maxBillDiscountPercent: String(settings.maxBillDiscountPercent),
      cashierMaxBillDiscountPercent: String(settings.cashierMaxBillDiscountPercent),
      allowHoldBill: settings.allowHoldBill,
      allowCreditSales: settings.allowCreditSales,
      showCashierOnReceipt: settings.showCashierOnReceipt,
      showGstBreakupOnReceipt: settings.showGstBreakupOnReceipt,
      showCustomerOnReceipt: settings.showCustomerOnReceipt,
      roundTotalToRupee: settings.roundTotalToRupee,
    })
  }, [settings])

  async function save() {
    if (!canEdit) return
    setSaving(true)
    try {
      await updateBillingSettings({
        maxLineDiscountPercent: Number(f.maxLineDiscountPercent),
        maxBillDiscountPercent: Number(f.maxBillDiscountPercent),
        cashierMaxBillDiscountPercent: Number(f.cashierMaxBillDiscountPercent),
        allowHoldBill: f.allowHoldBill,
        allowCreditSales: f.allowCreditSales,
        showCashierOnReceipt: f.showCashierOnReceipt,
        showGstBreakupOnReceipt: f.showGstBreakupOnReceipt,
        showCustomerOnReceipt: f.showCustomerOnReceipt,
        roundTotalToRupee: f.roundTotalToRupee,
      })
      invalidate()
      toast('Billing settings saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save billing settings', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Billing & POS" sub="Discount limits, credit sales, receipt content, and counter behaviour">
      {isLoading && <p className="muted">Loading billing settings…</p>}
      {error && <p className="muted" style={{ color: 'var(--danger)' }}>Could not load billing settings.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <Field label="Max line discount %" hint="Per product line on POS">
          <TextInput value={f.maxLineDiscountPercent} onChange={v => setF(s => ({ ...s, maxLineDiscountPercent: v }))} type="number" disabled={!canEdit} />
        </Field>
        <Field label="Max bill discount % (Manager+)" hint="Bill-level discount for managers and admins">
          <TextInput value={f.maxBillDiscountPercent} onChange={v => setF(s => ({ ...s, maxBillDiscountPercent: v }))} type="number" disabled={!canEdit} />
        </Field>
        <Field label="Max bill discount % (Cashier)" hint="Stricter limit for cashier role">
          <TextInput value={f.cashierMaxBillDiscountPercent} onChange={v => setF(s => ({ ...s, cashierMaxBillDiscountPercent: v }))} type="number" disabled={!canEdit} />
        </Field>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
        {([
          ['allowHoldBill', 'Allow bill hold', 'Cashiers can park carts as held bills'],
          ['allowCreditSales', 'Allow credit (khata) sales', 'Registered customers can pay on credit at POS'],
          ['showCashierOnReceipt', 'Show cashier on receipt', 'Prints cashier name on bills'],
          ['showGstBreakupOnReceipt', 'Show CGST/SGST breakup', 'Separate tax lines on receipt'],
          ['showCustomerOnReceipt', 'Show customer on receipt', 'Customer name on printed bill'],
          ['roundTotalToRupee', 'Round grand total to rupee', 'Drop paise on final total'],
        ] as const).map(([key, title, sub]) => (
          <div key={key} className="row" style={{ justifyContent: 'space-between', padding: '11px 4px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div>
              <div className="td-sub">{sub}</div>
            </div>
            <Switch checked={f[key]} onChange={v => setF(s => ({ ...s, [key]: v }))} disabled={!canEdit} />
          </div>
        ))}
      </div>
      {canEdit ? (
        <SaveBar onSave={() => void save()} onReset={() => settings && setF({
          maxLineDiscountPercent: String(settings.maxLineDiscountPercent),
          maxBillDiscountPercent: String(settings.maxBillDiscountPercent),
          cashierMaxBillDiscountPercent: String(settings.cashierMaxBillDiscountPercent),
          allowHoldBill: settings.allowHoldBill,
          allowCreditSales: settings.allowCreditSales,
          showCashierOnReceipt: settings.showCashierOnReceipt,
          showGstBreakupOnReceipt: settings.showGstBreakupOnReceipt,
          showCustomerOnReceipt: settings.showCustomerOnReceipt,
          roundTotalToRupee: settings.roundTotalToRupee,
        })} saving={saving} />
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>Read-only — contact a tenant admin to change billing rules.</p>
      )}
    </Card>
  )
}

function PrinterSettings() {
  const toast = useToast()
  const { user } = useAuth()
  const canEdit = canEditSettingsSection(user, 'printer')
  const { data: settings, isLoading, error } = usePrinterSettingsQuery()
  const invalidate = useInvalidatePrinterSettings()
  const [width, setWidth] = useState('80')
  const [auto, setAuto] = useState(false)
  const [copies, setCopies] = useState('1')
  const [showLogo, setShowLogo] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setWidth(String(settings.widthMm))
    setAuto(settings.autoPrint)
    setCopies(String(settings.copies))
    setShowLogo(settings.showLogo)
  }, [settings])

  async function save() {
    if (!canEdit) return
    setSaving(true)
    try {
      await updatePrinterSettings({
        widthMm: width === '58' ? 58 : 80,
        autoPrint: auto,
        copies: Number(copies),
        showLogo,
      })
      invalidate()
      toast('Printer settings saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save printer settings', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Printer Settings" sub="Receipt output configuration">
      {isLoading && <p className="muted">Loading printer settings…</p>}
      {error && <p className="muted" style={{ color: 'var(--danger)' }}>Could not load printer settings.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Receipt width">
          <Segmented value={width} onChange={v => canEdit && setWidth(v)} options={[{ value: '58', label: '58 mm' }, { value: '80', label: '80 mm' }]} />
        </Field>
        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Auto-print on bill completion</div>
            <div className="td-sub">Opens the print dialog when payment is confirmed at POS</div>
          </div>
          <Switch checked={auto} onChange={setAuto} disabled={!canEdit} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Show logo on receipt</div>
            <div className="td-sub">Uses the store logo from Store Profile</div>
          </div>
          <Switch checked={showLogo} onChange={setShowLogo} disabled={!canEdit} />
        </div>
        <Field label="Bill copies" hint="Number of copies printed per bill (max 3)">
          <div style={{ maxWidth: 160 }}>
            <Select value={copies} onChange={canEdit ? setCopies : undefined} options={['1', '2', '3'].map(c => ({ value: c, label: c + (c === '1' ? ' copy' : ' copies') }))} />
          </div>
        </Field>
      </div>
      {canEdit ? (
      <SaveBar
        onSave={() => void save()}
        onReset={() => {
          if (!settings) return
          setWidth(String(settings.widthMm))
          setAuto(settings.autoPrint)
          setCopies(String(settings.copies))
          setShowLogo(settings.showLogo)
        }}
        saving={saving}
      />
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>Read-only — printer settings can be changed by managers and admins.</p>
      )}
    </Card>
  )
}

function AuditLog() {
  const { data: entries = [], isLoading, error } = useAuditLogQuery(50)

  return (
    <Card title="Audit Log" sub="Read-only · last 50 system events" noBody>
      {isLoading && <div style={{ padding: 16 }} className="muted">Loading audit log…</div>}
      {error && <div style={{ padding: 16, color: 'var(--danger)' }}>Could not load audit log.</div>}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Action</th><th>User</th><th>Timestamp</th><th>IP address</th></tr></thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id}>
                <td className="td-strong">{formatAuditAction(entry)}</td>
                <td className="muted">{entry.userName}</td>
                <td className="muted tnum">{formatAuditTime(entry.createdAt)}</td>
                <td className="mono muted">{entry.ipAddress ?? '—'}</td>
              </tr>
            ))}
            {!isLoading && !error && entries.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ padding: 20, textAlign: 'center' }}>No events yet — actions will appear here as you use the system.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function Settings() {
  const { user } = useAuth()
  const visibleNav = SETTINGS_NAV.filter(s => canAccessSettingsSection(user, s.id))
  const [sec, setSec] = useState<SettingsSectionId>('store')
  const { data: profile } = useStoreProfileQuery()

  useEffect(() => {
    if (visibleNav.length && !visibleNav.some(s => s.id === sec)) {
      setSec(visibleNav[0].id)
    }
  }, [user, visibleNav, sec])

  return (
    <div className="content-pad" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div className="section-title">Settings</div>
        <div className="section-sub">
          Configure {profile?.name ?? 'your store'}
          {profile?.tenantId ? <> · Tenant <span className="mono">{profile.tenantId.slice(0, 8)}</span></> : null}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '212px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="settings-nav">
          {visibleNav.map(s => (
            <button key={s.id} className={'sb-nav' + (sec === s.id ? ' active' : '')} onClick={() => setSec(s.id)} style={{ marginBottom: 2 }}>
              <Icon name={s.icon} size={17} className="ic" /><span className="sb-txt">{s.label}</span>
            </button>
          ))}
        </div>
        <div>
          {sec === 'store' && canAccessSettingsSection(user, 'store') && <StoreProfile />}
          {sec === 'billing' && canAccessSettingsSection(user, 'billing') && <BillingSettings />}
          {sec === 'printer' && canAccessSettingsSection(user, 'printer') && <PrinterSettings />}
          {sec === 'users' && canAccessSettingsSection(user, 'users') && <UserManagement />}
          {sec === 'audit' && canAccessSettingsSection(user, 'audit') && <AuditLog />}
        </div>
      </div>
    </div>
  )
}
