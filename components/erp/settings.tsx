'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon, Button, Badge, Avatar, Field, TextInput, Select, Segmented, Switch, Modal, Card, IconTile, useToast } from './ui'
import { updateStoreProfile, uploadStoreLogo, resolveLogoUrl, updatePrinterSettings, updateBillingSettings, updateTaxSettings, runDatabaseBackup, type GstScheme } from '@/lib/settings-api'
import {
  useStoreProfileQuery,
  useInvalidateStoreProfile,
  usePrinterSettingsQuery,
  useInvalidatePrinterSettings,
  useBillingSettingsQuery,
  useInvalidateBillingSettings,
  useTaxSettingsQuery,
  useInvalidateTaxSettings,
  useDatabaseBackupStatusQuery,
  useInvalidateDatabaseBackups,
} from '@/lib/queries/use-settings'
import { useCategoriesQuery } from '@/lib/queries/use-catalog'
import { GST_SCHEME_HINTS, GST_SCHEME_LABELS, GST_SCHEME_GUIDE, STANDARD_GST_RATES, gstRateSelectOptions, customGstRates, parseGstRateInput } from '@/lib/gst'
import { formatRoleLabel, canAccessSettingsSection, canEditSettingsSection, type SettingsSectionId } from '@/lib/rbac'
import { useAuditLogQuery } from '@/lib/queries/use-audit'
import { formatAuditAction, formatAuditTime } from '@/lib/audit-api'
import { useUsersQuery, useInvalidateUsers } from '@/lib/queries/use-users'
import {
  createUser, updateUser, ASSIGNABLE_ROLES, formatLastLogin,
  type TenantUser, type UserRole, type UserStatus,
} from '@/lib/users-api'
import { useAuth } from '@/lib/auth-context'
import { fetchModuleAccess, updateModuleAccess } from '@/lib/module-access-api'
import { MERCANTILE_MODULES, type ModuleId } from '@/lib/modules'
import { setCurrency, type CurrencyCode } from '@/lib/erp-data'
import { money2 } from '@/lib/erp-data'
import { fetchShiftHistory, fetchShiftReport, forceCloseCashierShift, type CashierShiftReport } from '@/lib/cashier-shift-api'

export const SETTINGS_NAV: { id: SettingsSectionId; label: string; description: string; icon: string }[] = [
  { id: 'store', label: 'Store profile', description: 'Identity, contact and receipt details', icon: 'store' },
  { id: 'billing', label: 'Billing & POS', description: 'Checkout rules, discounts and tax', icon: 'scan-line' },
  { id: 'printer', label: 'Receipt output', description: 'Printer, copies and print behavior', icon: 'printer' },
  { id: 'backups', label: 'Backups', description: 'Local database protection and recovery history', icon: 'database-backup' },
  { id: 'users', label: 'Team access', description: 'Users, roles and sign-in access', icon: 'users' },
  { id: 'modules', label: 'Module access', description: 'Choose workspaces for every role', icon: 'layout-grid' },
  { id: 'shifts', label: 'Shift history', description: 'Review cashier shifts and print shift reports', icon: 'history' },
  { id: 'audit', label: 'Activity log', description: 'Review important system events', icon: 'scroll-text' },
]

function formatVariance(value: number) {
  if (value === 0) return money2(0)
  return `${value > 0 ? '+' : '−'}${money2(Math.abs(value))}`
}

function varianceColor(value: number) {
  if (value < 0) return 'var(--danger-fg)'
  if (value > 0) return 'var(--success-fg)'
  return 'var(--fg)'
}

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
    currency: 'QAR' as CurrencyCode,
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
      currency: profile.currency,
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
        currency: f.currency,
      })
      setCurrency(f.currency)
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
      <div className="store-profile-row" style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
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
        <div className="form-grid-2" style={{ flex: 1 }}>
          <div style={{ gridColumn: '1/-1' }}><Field label="Store name" required><TextInput value={f.name} onChange={set('name')} disabled={!canEdit} /></Field></div>
          <Field label="Phone"><TextInput value={f.phone} onChange={set('phone')} icon="phone" disabled={!canEdit} /></Field>
          <Field label="Commercial registration / TIN" hint="Qatar CR or Tax Identification Number"><TextInput value={f.gstin} onChange={set('gstin')} disabled={!canEdit} /></Field>
        </div>
      </div>
      <div className="form-grid-2">
        <div style={{ gridColumn: '1/-1' }}>
          <Field label="Address">
            <div className="input" style={{ height: 'auto' }}>
              <textarea className="bare" value={f.addr} onChange={e => set('addr')(e.target.value)} disabled={!canEdit} />
            </div>
          </Field>
        </div>
        <Field label="Bill number prefix" hint="Bills format as NJK-2025-00001"><TextInput value={f.prefix} onChange={set('prefix')} disabled={!canEdit} /></Field>
        <Field label="Bill footer message"><TextInput value={f.footer} onChange={set('footer')} disabled={!canEdit} /></Field>
        <Field label="Currency" hint="Used across POS, receipts and reports">
          <Select value={f.currency} onChange={value => setF(current => ({ ...current, currency: value as CurrencyCode }))} disabled={!canEdit}
            options={[{ value: 'QAR', label: 'Qatari Riyal (QAR)' }, { value: 'INR', label: 'Indian Rupee (INR)' }]} />
        </Field>
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
          currency: profile.currency,
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
    TENANT_ADMIN: 'primary', MANAGER: 'info', CASHIER: 'neutral', INVENTORY_STAFF: 'success', PROCUREMENT_STAFF: 'info', ACCOUNTANT: 'warning',
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

function ModuleAccessSettings() {
  const toast = useToast()
  const [matrix, setMatrix] = useState<Partial<Record<UserRole, ModuleId[]>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchModuleAccess()
      .then(data => {
        const next: Partial<Record<UserRole, ModuleId[]>> = {}
        for (const role of ASSIGNABLE_ROLES) {
          next[role.value] = (data.roles[role.value] ?? []).map(module => module.toLowerCase() as ModuleId)
        }
        setMatrix(next)
      })
      .catch(e => toast(e instanceof Error ? e.message : 'Could not load module access', { tone: 'danger' }))
      .finally(() => setLoading(false))
  }, [toast])

  function toggle(role: UserRole, module: ModuleId, enabled: boolean) {
    if (role === 'TENANT_ADMIN' && module === 'administration') return
    setMatrix(current => {
      const modules = new Set(current[role] ?? [])
      if (enabled) modules.add(module)
      else modules.delete(module)
      return { ...current, [role]: [...modules] }
    })
  }

  function roleSupports(role: UserRole, module: ModuleId) {
    const supported: Partial<Record<UserRole, ModuleId[]>> = {
      TENANT_ADMIN: ['overview', 'pos', 'inventory', 'procurement', 'administration'],
      MANAGER: ['overview', 'pos', 'inventory', 'procurement', 'administration'],
      CASHIER: ['overview', 'pos', 'inventory', 'administration'],
      INVENTORY_STAFF: ['overview', 'inventory', 'procurement'],
      PROCUREMENT_STAFF: ['procurement'],
      ACCOUNTANT: ['overview', 'pos', 'inventory', 'procurement', 'administration'],
    }
    return (supported[role] ?? []).includes(module)
  }

  async function save() {
    setSaving(true)
    try {
      const saved = await updateModuleAccess(matrix)
      const next: Partial<Record<UserRole, ModuleId[]>> = {}
      for (const role of ASSIGNABLE_ROLES) {
        next[role.value] = (saved.roles[role.value] ?? []).map(module => module.toLowerCase() as ModuleId)
      }
      setMatrix(next)
      toast('Module access updated — affected users will see it on their next session')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update module access', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Module Access" sub="Choose which Mercantile workspaces each role can enter" noBody>
      {loading ? <div style={{ padding: 16 }} className="muted">Loading module access…</div> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Role</th>{MERCANTILE_MODULES.map(module => <th key={module.id}>{module.label}</th>)}</tr></thead>
            <tbody>
              {ASSIGNABLE_ROLES.map(role => (
                <tr key={role.value}>
                  <td className="td-strong">{role.label}</td>
                  {MERCANTILE_MODULES.map(module => {
                    const unsupported = !roleSupports(role.value, module.id)
                    const locked = unsupported || (role.value === 'TENANT_ADMIN' && module.id === 'administration')
                    return <td key={module.id}>
                      <Switch
                        checked={(matrix[role.value] ?? []).includes(module.id)}
                        onChange={value => toggle(role.value, module.id, value)}
                        disabled={locked || saving}
                      />
                    </td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className="td-sub">Tenant Admin always retains Administration access.</span>
        <Button variant="primary" size="sm" icon="check" onClick={() => void save()} disabled={loading || saving}>
          {saving ? 'Saving…' : 'Save access'}
        </Button>
      </div>
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
    taxEnabled: false,
    showCashierOnReceipt: true,
    showGstBreakupOnReceipt: true,
    showCustomerOnReceipt: true,
    roundTotalToRupee: false,
    markOverdueShiftsAtClose: true,
    shiftClosingTime: '23:59',
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
      taxEnabled: settings.taxEnabled,
      showCashierOnReceipt: settings.showCashierOnReceipt,
      showGstBreakupOnReceipt: settings.showGstBreakupOnReceipt,
      showCustomerOnReceipt: settings.showCustomerOnReceipt,
      roundTotalToRupee: settings.roundTotalToRupee,
      markOverdueShiftsAtClose: settings.markOverdueShiftsAtClose,
      shiftClosingTime: settings.shiftClosingTime,
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
        taxEnabled: f.taxEnabled,
        showCashierOnReceipt: f.showCashierOnReceipt,
        showGstBreakupOnReceipt: f.showGstBreakupOnReceipt,
        showCustomerOnReceipt: f.showCustomerOnReceipt,
        roundTotalToRupee: f.roundTotalToRupee,
        markOverdueShiftsAtClose: f.markOverdueShiftsAtClose,
        shiftClosingTime: f.shiftClosingTime,
      })
      invalidate()
      toast('Billing settings saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save billing settings', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const toggleRows: { key: 'allowHoldBill' | 'allowCreditSales' | 'taxEnabled' | 'showCashierOnReceipt' | 'showGstBreakupOnReceipt' | 'showCustomerOnReceipt' | 'roundTotalToRupee' | 'markOverdueShiftsAtClose'; title: string; sub: string }[] = [
    { key: 'allowHoldBill', title: 'Allow bill hold', sub: 'Cashiers can park carts as held bills' },
    { key: 'allowCreditSales', title: 'Allow credit (khata) sales', sub: 'Registered customers can pay on credit at POS' },
    { key: 'taxEnabled', title: 'Enable tax calculation', sub: 'Turn on only when tax applies to this store' },
    { key: 'showCashierOnReceipt', title: 'Show cashier on receipt', sub: 'Prints cashier name on bills' },
    { key: 'showCustomerOnReceipt', title: 'Show customer on receipt', sub: 'Customer name on printed bill' },
    { key: 'roundTotalToRupee', title: 'Round grand total to rupee', sub: 'Drop paise on final total' },
    { key: 'markOverdueShiftsAtClose', title: 'Require daily shift reconciliation', sub: 'At the cutoff, unclosed shifts become overdue and billing is blocked' },
  ]
  if (f.taxEnabled) toggleRows.splice(4, 0, { key: 'showGstBreakupOnReceipt', title: 'Show tax breakdown', sub: 'Separate tax lines on receipt' })

  return (
    <Card title="Billing & POS" sub="Discount limits, credit sales, receipt content, and counter behaviour">
      {isLoading && <p className="muted">Loading billing settings…</p>}
      {error && <p className="muted" style={{ color: 'var(--danger)' }}>Could not load billing settings.</p>}
      <div className="form-grid-2" style={{ marginBottom: 16 }}>
        <Field label="Max line discount %" hint="Per product line on POS">
          <TextInput value={f.maxLineDiscountPercent} onChange={v => setF(s => ({ ...s, maxLineDiscountPercent: v }))} type="number" disabled={!canEdit} />
        </Field>
        <Field label="Max bill discount % (Manager+)" hint="Bill-level discount for managers and admins">
          <TextInput value={f.maxBillDiscountPercent} onChange={v => setF(s => ({ ...s, maxBillDiscountPercent: v }))} type="number" disabled={!canEdit} />
        </Field>
        <Field label="Max bill discount % (Cashier)" hint="Stricter limit for cashier role">
          <TextInput value={f.cashierMaxBillDiscountPercent} onChange={v => setF(s => ({ ...s, cashierMaxBillDiscountPercent: v }))} type="number" disabled={!canEdit} />
        </Field>
        <Field label="Business-day shift cutoff" hint="Qatar time. Missed shifts become overdue after this time.">
          <TextInput value={f.shiftClosingTime} onChange={v => setF(s => ({ ...s, shiftClosingTime: v }))} type="time" disabled={!canEdit || !f.markOverdueShiftsAtClose} />
        </Field>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
        {toggleRows.map(({ key, title, sub }) => (
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
          taxEnabled: settings.taxEnabled,
          showCashierOnReceipt: settings.showCashierOnReceipt,
          showGstBreakupOnReceipt: settings.showGstBreakupOnReceipt,
          showCustomerOnReceipt: settings.showCustomerOnReceipt,
          roundTotalToRupee: settings.roundTotalToRupee,
          markOverdueShiftsAtClose: settings.markOverdueShiftsAtClose,
          shiftClosingTime: settings.shiftClosingTime,
        })} saving={saving} />
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>Read-only — contact a tenant admin to change billing rules.</p>
      )}
    </Card>
  )
}

const RATE_OPTIONS = [...STANDARD_GST_RATES]

function GstSchemeSettings() {
  const toast = useToast()
  const { user } = useAuth()
  const canEdit = canEditSettingsSection(user, 'billing')
  const { data: settings, isLoading, error } = useTaxSettingsQuery()
  const categoriesQuery = useCategoriesQuery()
  const categories = categoriesQuery.data ?? []
  const invalidate = useInvalidateTaxSettings()
  const [f, setF] = useState({
    scheme: 'PRODUCT' as GstScheme,
    priceIncludesTax: false,
    enabledRates: [0, 5, 12, 18] as number[],
    compositeRatePct: '5',
    defaultCategoryRatePct: '5',
    categoryRates: {} as Record<string, string>,
  })
  const [saving, setSaving] = useState(false)
  const [customRateInput, setCustomRateInput] = useState('')

  useEffect(() => {
    if (!settings) return
    const map: Record<string, string> = {}
    for (const row of settings.categoryRates) {
      map[row.categoryId] = String(row.ratePct)
    }
    setF({
      scheme: settings.scheme,
      priceIncludesTax: settings.priceIncludesTax,
      enabledRates: settings.enabledRates.length ? settings.enabledRates : [0, 5, 12, 18],
      compositeRatePct: String(settings.compositeRatePct),
      defaultCategoryRatePct: String(settings.defaultCategoryRatePct),
      categoryRates: map,
    })
  }, [settings])

  function toggleRate(rate: number) {
    if (!canEdit) return
    setF(s => {
      const on = s.enabledRates.includes(rate)
      const next = on ? s.enabledRates.filter(r => r !== rate) : [...s.enabledRates, rate].sort((a, b) => a - b)
      return { ...s, enabledRates: next.length ? next : [rate] }
    })
  }

  function addCustomRate() {
    if (!canEdit) return
    const rate = parseGstRateInput(customRateInput)
    if (rate == null) {
      toast('Enter a GST rate between 0 and 100', { tone: 'danger' })
      return
    }
    setF(s => ({
      ...s,
      enabledRates: [...new Set([...s.enabledRates, rate])].sort((a, b) => a - b),
    }))
    setCustomRateInput('')
  }

  function removeCustomRate(rate: number) {
    if (!canEdit) return
    setF(s => ({
      ...s,
      enabledRates: s.enabledRates.filter(r => r !== rate),
    }))
  }

  async function save() {
    if (!canEdit) return
    setSaving(true)
    try {
      const categoryRates = categories
        .map(c => ({
          categoryId: c.id,
          ratePct: Number(f.categoryRates[c.id] ?? f.defaultCategoryRatePct),
        }))
        .filter(r => !Number.isNaN(r.ratePct))
      await updateTaxSettings({
        scheme: f.scheme,
        priceIncludesTax: f.priceIncludesTax,
        enabledRates: f.enabledRates,
        compositeRatePct: Number(f.compositeRatePct),
        defaultCategoryRatePct: Number(f.defaultCategoryRatePct),
        categoryRates,
      })
      invalidate()
      toast('GST scheme saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save tax settings', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    if (!settings) return
    const map: Record<string, string> = {}
    for (const row of settings.categoryRates) map[row.categoryId] = String(row.ratePct)
    setF({
      scheme: settings.scheme,
      priceIncludesTax: settings.priceIncludesTax,
      enabledRates: settings.enabledRates,
      compositeRatePct: String(settings.compositeRatePct),
      defaultCategoryRatePct: String(settings.defaultCategoryRatePct),
      categoryRates: map,
    })
  }

  return (
    <Card title="Tax calculation" sub="Qatar stores can keep this at 0% until a tax rule applies.">
      {isLoading && <p className="muted">Loading tax settings…</p>}
      {error && <p className="muted" style={{ color: 'var(--danger)' }}>Could not load tax settings.</p>}
      <Field label="Billing scheme" hint={GST_SCHEME_HINTS[f.scheme]}>
        <Segmented
          value={f.scheme}
          onChange={v => { if (canEdit) setF(s => ({ ...s, scheme: v as GstScheme })) }}
          options={([
            ['PRODUCT', 'Product'],
            ['COMPOSITE', 'Composite'],
            ['CATEGORY', 'Category'],
          ] as const).map(([value, label]) => ({ value, label }))}
        />
      </Field>
      <p className="muted" style={{ margin: '10px 0 16px', fontSize: 13 }}>
        <b>{GST_SCHEME_LABELS[f.scheme]}</b> — {GST_SCHEME_HINTS[f.scheme]}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
        {GST_SCHEME_GUIDE.map(g => (
          <div key={g.title}>
            <div style={{ fontWeight: 650, fontSize: 13 }}>{g.title}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{g.body}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Enabled tax rates</div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {RATE_OPTIONS.map(rate => (
            <button
              key={rate}
              type="button"
              className={'chip' + (f.enabledRates.includes(rate) ? ' on' : '')}
              onClick={() => toggleRate(rate)}
              disabled={!canEdit}
            >
              {rate}%
            </button>
          ))}
        </div>
        {customGstRates(f.enabledRates).length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Custom rates</div>
            <div className="chips">
              {customGstRates(f.enabledRates).map(rate => (
                <button
                  key={rate}
                  type="button"
                  className="chip on"
                  onClick={() => removeCustomRate(rate)}
                  disabled={!canEdit}
                  title={canEdit ? 'Click to remove' : undefined}
                >
                  {rate}%{canEdit ? ' ×' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
        {canEdit && (
          <div className="row gap8" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="Add custom rate %" hint="e.g. 1, 3, 28 — used in products & category mapping" optional>
              <TextInput
                value={customRateInput}
                onChange={setCustomRateInput}
                type="number"
                placeholder="28"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); addCustomRate() } }}
              />
            </Field>
            <Button size="sm" variant="outline" icon="plus" onClick={addCustomRate}>Add</Button>
          </div>
        )}
      </div>
      {f.scheme === 'COMPOSITE' && (
        <div className="form-grid-2" style={{ marginBottom: 16 }}>
          <Field label="Composite tax %" hint="Single rate applied on the bill total">
            <Select
              value={f.compositeRatePct}
              onChange={v => setF(s => ({ ...s, compositeRatePct: v }))}
              options={gstRateSelectOptions(f.enabledRates, f.compositeRatePct)}
              disabled={!canEdit}
            />
          </Field>
        </div>
      )}
      {f.scheme === 'CATEGORY' && (
        <div style={{ marginBottom: 16 }}>
          <div className="form-grid-2" style={{ marginBottom: 12 }}>
            <Field label="Default category rate %" hint="Used when a category has no mapping">
              <Select
                value={f.defaultCategoryRatePct}
                onChange={v => setF(s => ({ ...s, defaultCategoryRatePct: v }))}
                options={gstRateSelectOptions(f.enabledRates, f.defaultCategoryRatePct)}
                disabled={!canEdit}
              />
            </Field>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Category tax mapping</div>
          {categoriesQuery.isPending && <p className="muted">Loading categories…</p>}
          {!categoriesQuery.isPending && categories.length === 0 && (
            <p className="muted">No categories found — import products or add categories first.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.map(c => (
              <div key={c.id} className="row gap10" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 13.5, minWidth: 120 }}>{c.name}</span>
                <Select
                  width={120}
                  size="sm"
                  value={f.categoryRates[c.id] ?? f.defaultCategoryRatePct}
                  onChange={v => setF(s => ({
                    ...s,
                    categoryRates: { ...s.categoryRates, [c.id]: v },
                  }))}
                  options={gstRateSelectOptions(f.enabledRates, f.categoryRates[c.id] ?? f.defaultCategoryRatePct)}
                  disabled={!canEdit}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'space-between', padding: '11px 4px', borderTop: '1px solid var(--border)', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Prices include tax</div>
          <div className="td-sub">Selling prices are tax-inclusive (MRP style)</div>
        </div>
        <Switch checked={f.priceIncludesTax} onChange={v => setF(s => ({ ...s, priceIncludesTax: v }))} disabled={!canEdit} />
      </div>
      {canEdit ? (
        <SaveBar onSave={() => void save()} onReset={resetForm} saving={saving} />
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>Read-only — contact a tenant admin to change tax rules.</p>
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
  const [autoDownload, setAutoDownload] = useState(false)
  const [copies, setCopies] = useState('1')
  const [showLogo, setShowLogo] = useState(true)
  const [receiptTitle, setReceiptTitle] = useState('SALES RECEIPT')
  const [cashDrawerEnabled, setCashDrawerEnabled] = useState(false)
  const [cashDrawerConnection, setCashDrawerConnection] = useState<'RECEIPT_PRINTER' | 'USB' | 'NETWORK'>('RECEIPT_PRINTER')
  const [cashDrawerName, setCashDrawerName] = useState('')
  const [cashDrawerPort, setCashDrawerPort] = useState<'DRAWER_1' | 'DRAWER_2'>('DRAWER_1')
  const [openDrawerOnCashPayment, setOpenDrawerOnCashPayment] = useState(true)
  const [allowManualDrawerOpen, setAllowManualDrawerOpen] = useState(false)
  const [content, setContent] = useState({
    showStorePhone: true, showStoreAddress: true, showStoreTin: true, showBillDate: true,
    showCustomer: true, showCashier: true, showPayment: true, showTendered: true,
    showChange: true, showTaxBreakup: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setWidth(String(settings.widthMm))
    setAuto(settings.autoPrint)
    setAutoDownload(settings.autoDownloadReceipt)
    setCopies(String(settings.copies))
    setShowLogo(settings.showLogo)
    setReceiptTitle(settings.receiptTitle)
    setCashDrawerEnabled(settings.cashDrawerEnabled)
    setCashDrawerConnection(settings.cashDrawerConnection)
    setCashDrawerName(settings.cashDrawerName)
    setCashDrawerPort(settings.cashDrawerPort)
    setOpenDrawerOnCashPayment(settings.openDrawerOnCashPayment)
    setAllowManualDrawerOpen(settings.allowManualDrawerOpen)
    setContent({
      showStorePhone: settings.showStorePhone, showStoreAddress: settings.showStoreAddress,
      showStoreTin: settings.showStoreTin, showBillDate: settings.showBillDate,
      showCustomer: settings.showCustomer, showCashier: settings.showCashier,
      showPayment: settings.showPayment, showTendered: settings.showTendered,
      showChange: settings.showChange, showTaxBreakup: settings.showTaxBreakup,
    })
  }, [settings])

  async function save() {
    if (!canEdit) return
    setSaving(true)
    try {
      await updatePrinterSettings({
        widthMm: width === '58' ? 58 : 80,
        autoPrint: auto,
        autoDownloadReceipt: autoDownload,
        copies: Number(copies),
        showLogo,
        receiptTitle: receiptTitle.trim() || 'SALES RECEIPT',
        cashDrawerEnabled,
        cashDrawerConnection,
        cashDrawerName: cashDrawerName.trim(),
        cashDrawerPort,
        openDrawerOnCashPayment,
        allowManualDrawerOpen,
        ...content,
      })
      invalidate()
      toast('Receipt output settings saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save printer settings', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Receipt output" sub="Choose exactly what customers see on printed and downloaded bills">
      {isLoading && <p className="muted">Loading printer settings…</p>}
      {error && <p className="muted" style={{ color: 'var(--danger)' }}>Could not load printer settings.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-grid-2">
          <Field label="Receipt title" hint="For example: TAX INVOICE or SALES RECEIPT"><TextInput value={receiptTitle} onChange={setReceiptTitle} disabled={!canEdit} maxLength={48} /></Field>
          <Field label="Receipt width"><Segmented value={width} onChange={v => canEdit && setWidth(v)} options={[{ value: '58', label: '58 mm' }, { value: '80', label: '80 mm' }]} /></Field>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Auto-print on bill completion</div>
            <div className="td-sub">Opens the print dialog when payment is confirmed at POS</div>
          </div>
          <Switch checked={auto} onChange={setAuto} disabled={!canEdit} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Auto-download receipt</div>
            <div className="td-sub">Downloads a PNG receipt after each completed sale</div>
          </div>
          <Switch checked={autoDownload} onChange={setAutoDownload} disabled={!canEdit} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Show logo on receipt</div>
            <div className="td-sub">Uses the store logo from Store Profile</div>
          </div>
          <Switch checked={showLogo} onChange={setShowLogo} disabled={!canEdit} />
        </div>
        <Field label="Bill copies" hint="Number of copies printed per bill (max 3)">
          <div className="form-field-narrow">
            <Select value={copies} onChange={canEdit ? setCopies : undefined} options={['1', '2', '3'].map(c => ({ value: c, label: c + (c === '1' ? ' copy' : ' copies') }))} />
          </div>
        </Field>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>Cash drawer</div>
          <div className="td-sub" style={{ marginBottom: 10 }}>Connect the drawer to the assigned receipt printer. Never connect the drawer cable to a router or network switch.</div>
          <div className="row" style={{ justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
            <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>Use a cash drawer</div><div className="td-sub">Enables cash-drawer controls for the configured POS hardware</div></div>
            <Switch checked={cashDrawerEnabled} onChange={setCashDrawerEnabled} disabled={!canEdit} />
          </div>
          {cashDrawerEnabled && <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div className="form-grid-2">
              <Field label="Connection method" hint="Most drawers connect through the receipt printer"><Select value={cashDrawerConnection} onChange={v => setCashDrawerConnection(v as typeof cashDrawerConnection)} disabled={!canEdit} options={[{ value: 'RECEIPT_PRINTER', label: 'Receipt printer drawer port' }, { value: 'USB', label: 'USB drawer interface' }, { value: 'NETWORK', label: 'Network printer drawer port' }]} /></Field>
              <Field label="Drawer port"><Select value={cashDrawerPort} onChange={v => setCashDrawerPort(v as typeof cashDrawerPort)} disabled={!canEdit} options={[{ value: 'DRAWER_1', label: 'Drawer 1' }, { value: 'DRAWER_2', label: 'Drawer 2' }]} /></Field>
            </div>
            <Field label="Assigned drawer or printer" hint="For example: Main Counter Epson TM T20"><TextInput value={cashDrawerName} onChange={setCashDrawerName} disabled={!canEdit} maxLength={80} placeholder="Main Counter receipt printer" /></Field>
            <div className="form-grid-2">
              <div className="row" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', gap: 12 }}><div><div style={{ fontWeight: 600, fontSize: 13.5 }}>Open after cash payment</div><div className="td-sub">Never opens for card, UPI, or credit payments</div></div><Switch checked={openDrawerOnCashPayment} onChange={setOpenDrawerOnCashPayment} disabled={!canEdit} /></div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', gap: 12 }}><div><div style={{ fontWeight: 600, fontSize: 13.5 }}>Allow manual drawer open</div><div className="td-sub">Use only for authorised staff and record each opening</div></div><Switch checked={allowManualDrawerOpen} onChange={setAllowManualDrawerOpen} disabled={!canEdit} /></div>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', padding: '10px 0 0' }}><span className="td-sub">A Test drawer action becomes available in the Electron app after the printer driver is connected at this counter.</span><Button size="sm" variant="outline" icon="plug-zap" disabled title="Cash-drawer commands require the local Electron printer driver">Test drawer</Button></div>
          </div>}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>Receipt content</div>
          <div className="td-sub" style={{ marginBottom: 10 }}>Turn lines on or off without changing the bill calculation.</div>
          <div className="form-grid-2">
            {([
              ['showStorePhone', 'Store phone', 'Contact number from Store Profile'],
              ['showStoreAddress', 'Store address', 'Address from Store Profile'],
              ['showStoreTin', 'CR / TIN number', 'Registration number from Store Profile'],
              ['showBillDate', 'Bill date and time', 'Invoice issue time'],
              ['showCustomer', 'Customer name', 'Shows the selected or walk-in customer'],
              ['showCashier', 'Cashier name', 'Shows the staff member who made the bill'],
              ['showPayment', 'Payment method', 'Cash, card, credit, and similar'],
              ['showTendered', 'Tendered amount', 'Amount received from the customer'],
              ['showChange', 'Change due', 'Change returned to the customer'],
              ['showTaxBreakup', 'Tax breakdown', 'Only shown when tax is enabled in Billing & POS'],
            ] as const).map(([key, title, sub]) => (
              <div key={key} className="row" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', gap: 12 }}>
                <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div><div className="td-sub">{sub}</div></div>
                <Switch checked={content[key]} onChange={v => setContent(s => ({ ...s, [key]: v }))} disabled={!canEdit} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {canEdit ? (
      <SaveBar
        onSave={() => void save()}
        onReset={() => {
          if (!settings) return
          setWidth(String(settings.widthMm))
          setAuto(settings.autoPrint)
          setAutoDownload(settings.autoDownloadReceipt)
          setCopies(String(settings.copies))
          setShowLogo(settings.showLogo)
          setReceiptTitle(settings.receiptTitle)
          setCashDrawerEnabled(settings.cashDrawerEnabled)
          setCashDrawerConnection(settings.cashDrawerConnection)
          setCashDrawerName(settings.cashDrawerName)
          setCashDrawerPort(settings.cashDrawerPort)
          setOpenDrawerOnCashPayment(settings.openDrawerOnCashPayment)
          setAllowManualDrawerOpen(settings.allowManualDrawerOpen)
          setContent({
            showStorePhone: settings.showStorePhone, showStoreAddress: settings.showStoreAddress,
            showStoreTin: settings.showStoreTin, showBillDate: settings.showBillDate,
            showCustomer: settings.showCustomer, showCashier: settings.showCashier,
            showPayment: settings.showPayment, showTendered: settings.showTendered,
            showChange: settings.showChange, showTaxBreakup: settings.showTaxBreakup,
          })
        }}
        saving={saving}
      />
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>Read-only — printer settings can be changed by managers and admins.</p>
      )}
    </Card>
  )
}

function formatBackupSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function BackupSettings() {
  const toast = useToast()
  const { data, isLoading, error } = useDatabaseBackupStatusQuery()
  const invalidate = useInvalidateDatabaseBackups()
  const [requesting, setRequesting] = useState(false)
  const busy = data?.history.some(backup => backup.status === 'QUEUED' || backup.status === 'RUNNING') ?? false

  async function createBackup() {
    setRequesting(true)
    try {
      await runDatabaseBackup()
      invalidate()
      toast('Backup queued. This page will update while the archive is created.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start database backup', { tone: 'danger' })
    } finally {
      setRequesting(false)
    }
  }

  const statusTone = (status: string) => status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'danger' : 'warning'
  const statusLabel = (status: string) => status === 'QUEUED' ? 'Queued' : status === 'RUNNING' ? 'Creating backup…' : status === 'COMPLETED' ? 'Completed' : 'Failed'

  return (
    <Card title="Local database backups" sub="Protect this on-premise installation with PostgreSQL recovery archives" noBody>
      <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}>
        {isLoading && <p className="muted" style={{ margin: 0 }}>Checking backup configuration…</p>}
        {error && <p style={{ color: 'var(--danger)', margin: 0 }}>Could not load backup status.</p>}
        {data && <>
          <div className="form-grid-2">
            <div className="row" style={{ gap: 11, padding: 13, background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
              <IconTile icon="shield-check" tone={data.enabled && data.storageConfigured ? 'tile-success' : 'tile-warning'} size={32} />
              <div><div style={{ fontWeight: 700 }}>{data.enabled && data.storageConfigured ? 'Backup protection is active' : 'Backup protection needs server setup'}</div><div className="td-sub">{data.enabled ? (data.storageConfigured ? 'Archives are saved on this local server.' : 'Choose a writable local backup folder.') : 'Automatic backups are currently disabled.'}</div></div>
            </div>
            <div style={{ padding: 13, background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
              <div className="td-sub">Schedule</div><div style={{ fontWeight: 700, marginTop: 2 }}>{data.scheduleDescription}</div>
              <div className="td-sub" style={{ marginTop: 5 }}>Keeps the latest {data.retentionDays} days of completed archives.</div>
            </div>
          </div>
          {(!data.enabled || !data.storageConfigured) && <div style={{ marginTop: 14, padding: '11px 13px', borderRadius: 'var(--r-md)', border: '1px solid var(--warning-border)', background: 'var(--warning-bg)', color: 'var(--warning-fg)', fontSize: 13 }}>
            On the server, set <code>APP_BACKUP_ENABLED=true</code> and <code>APP_BACKUP_DIR</code> to a secure writable folder. {data.backupMode === 'DOCKER' ? <>Docker Desktop must be running and the configured database container must be available.</> : <>PostgreSQL&apos;s <code>pg_dump</code> must also be installed or configured with <code>APP_BACKUP_PG_DUMP_PATH</code>.</>}
          </div>}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 16, gap: 12, flexWrap: 'wrap' }}>
            <span className="td-sub">Archives are server-side <code>.dump</code> files for recovery with <code>pg_restore</code>. Restoring is deliberately not available from the normal app.</span>
            <Button variant="primary" icon="database-backup" onClick={() => void createBackup()} disabled={requesting || busy || !data.enabled || !data.storageConfigured}>{requesting ? 'Starting…' : busy ? 'Backup in progress…' : 'Create backup now'}</Button>
          </div>
        </>}
      </div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Archive</th><th>Started</th><th>Type</th><th>Size</th><th>Status</th><th>Details</th></tr></thead><tbody>
        {(data?.history ?? []).map(backup => <tr key={backup.id}>
          <td className="mono td-strong">{backup.fileName}</td>
          <td className="muted">{new Date(backup.startedAt).toLocaleString()}</td>
          <td><Badge tone="neutral">{backup.triggerType === 'SCHEDULED' ? 'Scheduled' : 'Manual'}</Badge></td>
          <td className="tnum">{formatBackupSize(backup.sizeBytes)}</td>
          <td><Badge tone={statusTone(backup.status)} dot>{statusLabel(backup.status)}</Badge></td>
          <td className="td-sub" style={{ maxWidth: 310 }}>{backup.errorMessage || (backup.completedAt ? `Finished ${new Date(backup.completedAt).toLocaleString()}` : 'Waiting for server worker')}</td>
        </tr>)}
        {!isLoading && data?.history.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: 'center' }}>No backups have been created on this server yet.</td></tr>}
      </tbody></table></div>
    </Card>
  )
}

function ShiftHistory() {
  const toast = useToast()
  const [rows, setRows] = useState<CashierShiftReport[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'OVERDUE' | 'CLOSED'>('ALL')
  const [cashierQuery, setCashierQuery] = useState('')
  const [openedDate, setOpenedDate] = useState('')
  const [selected, setSelected] = useState<CashierShiftReport | null>(null)
  const [forceClose, setForceClose] = useState<CashierShiftReport | null>(null)
  const [forceCash, setForceCash] = useState('')
  const [forceReason, setForceReason] = useState('')
  const [forceBusy, setForceBusy] = useState(false)

  async function searchShifts() {
    setLoading(true)
    try { setRows(await fetchShiftHistory()); setHasSearched(true) }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not load shift history', { tone: 'danger' }) }
    finally { setLoading(false) }
  }

  async function openReport(row: CashierShiftReport) {
    try { setSelected(await fetchShiftReport(row.id)) }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not load shift report', { tone: 'danger' }) }
  }

  async function closeOverdueShift() {
    if (!forceClose || !forceReason.trim()) return
    const countedCash = Number(forceCash)
    if (!Number.isFinite(countedCash) || countedCash < 0) return
    setForceBusy(true)
    try {
      await forceCloseCashierShift(forceClose.id, countedCash, forceReason.trim())
      toast(`Manager closed ${forceClose.cashierName}'s overdue shift`)
      setForceClose(null); setForceCash(''); setForceReason('')
      await searchShifts()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not close overdue shift', { tone: 'danger' })
    } finally { setForceBusy(false) }
  }

  function printReport(report: CashierShiftReport) {
    const cashSales = Math.max(0, (report.expectedCash ?? report.openingCash) - report.openingCash)
    const safe = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
    const popup = window.open('', '_blank', 'width=420,height=680')
    if (!popup) { toast('Allow pop-ups to print this report', { tone: 'danger' }); return }
    const title = report.status === 'OPEN' ? 'Current Shift Report' : 'Shift Closing Report'
    const rowsHtml = [
      ['Opening cash float', report.openingCash], ['Cash sales', cashSales], ['Card sales', report.expectedCard ?? 0],
      ['UPI / wallet sales', report.expectedUpi ?? 0], ['Credit sales', report.expectedCredit ?? 0], ['Expected drawer cash', report.expectedCash ?? report.openingCash],
      ...(report.status === 'CLOSED' ? [['Counted cash', report.countedCash ?? 0], ['Variance', report.variance ?? 0]] : []),
    ].map(([label, value]) => `<tr><td>${safe(String(label))}</td><td>${label === 'Variance' ? formatVariance(Number(value)) : money2(Number(value))}</td></tr>`).join('')
    popup.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font:14px Arial;padding:24px;color:#222}h1{font-size:20px;margin:0 0 6px}p{color:#666;margin:0 0 18px}table{width:100%;border-collapse:collapse}td{padding:9px 0;border-bottom:1px dashed #bbb}td:last-child{text-align:right;font-weight:700}.foot{margin-top:18px;font-size:12px;color:#666}</style></head><body><h1>${title}</h1><p>Cashier: ${safe(report.cashierName)}<br>Opened: ${new Date(report.openedAt).toLocaleString()}${report.closedAt ? `<br>Closed: ${new Date(report.closedAt).toLocaleString()}` : ''}</p><table>${rowsHtml}</table>${report.closingNote ? `<p class="foot">Closing note: ${safe(report.closingNote)}</p>` : ''}<script>window.print()</script></body></html>`)
    popup.document.close()
  }

  const visible = rows.filter(row => {
    if (status !== 'ALL' && row.status !== status) return false
    if (cashierQuery.trim() && !row.cashierName.toLowerCase().includes(cashierQuery.trim().toLowerCase())) return false
    if (openedDate && new Date(row.openedAt).toLocaleDateString('en-CA') !== openedDate) return false
    return true
  })
  return <>
    <Card title="Shift History" sub="Manager-only cashier shift reconciliation and printable reports" action={<Select width={190} size="sm" value={status} onChange={v => setStatus(v as typeof status)} options={[{ value: 'ALL', label: 'All shifts' }, { value: 'OPEN', label: 'Open shifts' }, { value: 'OVERDUE', label: 'Overdue shifts' }, { value: 'CLOSED', label: 'Closed shifts' }]} />} noBody>
      {loading && <div style={{ padding: 16 }} className="muted">Loading shift history…</div>}
      <div className="row gap10" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ width: 240, maxWidth: '100%' }}><TextInput value={cashierQuery} onChange={setCashierQuery} placeholder="Search cashier name" icon="search" size="sm" /></div>
        <div style={{ width: 170, maxWidth: '100%' }}><TextInput value={openedDate} onChange={setOpenedDate} type="date" size="sm" /></div>
        <Button size="sm" variant="primary" icon="search" disabled={loading} onClick={() => void searchShifts()}>{loading ? 'Searching…' : 'Search shifts'}</Button>
        {(cashierQuery || openedDate || status !== 'ALL') && <Button size="sm" variant="ghost" onClick={() => { setCashierQuery(''); setOpenedDate(''); setStatus('ALL'); setRows([]); setHasSearched(false) }}>Clear filters</Button>}
      </div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Cashier</th><th>Opened</th><th>Status</th><th>Expected cash</th><th>Variance</th><th></th></tr></thead><tbody>
        {visible.map(row => <tr key={row.id}><td><div className="cell-stack"><span className="td-strong">{row.cashierName}</span><span className="td-sub">{row.id.slice(0, 8)}</span></div></td><td className="muted">{new Date(row.openedAt).toLocaleString()}</td><td><Badge tone={row.status === 'OPEN' ? 'success' : row.status === 'OVERDUE' ? 'warning' : 'neutral'} dot>{row.status === 'OPEN' ? 'Current shift' : row.status === 'OVERDUE' ? 'Overdue' : 'Closed shift'}</Badge></td><td className="tnum">{money2(row.expectedCash ?? row.openingCash)}</td><td className="tnum" style={{ color: varianceColor(row.variance ?? 0) }}>{row.status === 'CLOSED' ? formatVariance(row.variance ?? 0) : '—'}</td><td><div className="row gap6"><Button size="sm" variant="outline" icon="file-text" onClick={() => void openReport(row)}>View</Button>{row.status === 'OVERDUE' && <Button size="sm" variant="primary" icon="shield-check" onClick={() => { setForceClose(row); setForceCash(String(row.expectedCash ?? row.openingCash)); setForceReason('') }}>Manager close</Button>}</div></td></tr>)}
        {!loading && hasSearched && visible.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: 'center' }}>No shifts match this search.</td></tr>}
        {!loading && !hasSearched && <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: 'center' }}>Choose filters if needed, then click Search shifts.</td></tr>}
      </tbody></table></div>
    </Card>
    {selected && <Modal title={selected.status === 'OPEN' ? 'Current shift report' : 'Shift closing report'} sub={`${selected.cashierName} · ${new Date(selected.openedAt).toLocaleString()}`} icon="history" onClose={() => setSelected(null)} footer={<><Button variant="outline" onClick={() => setSelected(null)}>Close</Button><Button variant="primary" icon="printer" onClick={() => printReport(selected)}>Print report</Button></>}><div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {[['Opening cash float', selected.openingCash], ['Cash sales', Math.max(0, (selected.expectedCash ?? selected.openingCash) - selected.openingCash)], ['Card sales', selected.expectedCard ?? 0], ['UPI / wallet sales', selected.expectedUpi ?? 0], ['Credit sales', selected.expectedCredit ?? 0], ['Expected cash in drawer', selected.expectedCash ?? selected.openingCash], ...(selected.status === 'CLOSED' ? [['Counted cash', selected.countedCash ?? 0], ['Variance', selected.variance ?? 0]] : [])].map(([label, value]) => <div key={String(label)} className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}><span>{label}</span><strong className="tnum" style={label === 'Variance' ? { color: varianceColor(Number(value)) } : undefined}>{label === 'Variance' ? formatVariance(Number(value)) : money2(Number(value))}</strong></div>)}
      {selected.closingNote && <div className="td-sub" style={{ marginTop: 4 }}>Closing note: {selected.closingNote}</div>}
    </div></Modal>}
    {forceClose && <Modal title="Manager close overdue shift" sub={`${forceClose.cashierName} · opened ${new Date(forceClose.openedAt).toLocaleString()}`} icon="shield-check" onClose={() => !forceBusy && setForceClose(null)} footer={<><Button variant="outline" onClick={() => setForceClose(null)} disabled={forceBusy}>Cancel</Button><Button variant="primary" icon="check" onClick={() => void closeOverdueShift()} disabled={forceBusy || !forceReason.trim() || forceCash === ''}>{forceBusy ? 'Closing…' : 'Close & reconcile'}</Button></>}><div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><div className="td-sub">This is recorded in the activity log. Enter the counted cash and a reason before closing.</div><Field label="Expected cash"><TextInput value={money2(forceClose.expectedCash ?? forceClose.openingCash)} onChange={() => {}} disabled /></Field><Field label="Counted cash" required><TextInput type="number" value={forceCash} onChange={setForceCash} /></Field><Field label="Manager close reason" required><TextInput value={forceReason} onChange={setForceReason} placeholder="Cashier absent, register issue…" /></Field></div></Modal>}
  </>
}

function AuditLog() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedDates, setAppliedDates] = useState<{ fromDate?: string; toDate?: string }>({})
  const hasIncompleteRange = Boolean(fromDate) !== Boolean(toDate)
  const { data: entries = [], isLoading, error } = useAuditLogQuery(500, appliedDates)

  function applyDateFilter() {
    if (hasIncompleteRange) return
    setAppliedDates(fromDate && toDate ? { fromDate, toDate } : {})
  }

  return (
    <Card title="Activity log" sub={appliedDates.fromDate ? `Read-only · ${appliedDates.fromDate} to ${appliedDates.toDate}` : 'Read-only · latest system activity'} noBody>
      {isLoading && <div style={{ padding: 16 }} className="muted">Loading audit log…</div>}
      {error && <div style={{ padding: 16, color: 'var(--danger)' }}>Could not load audit log.</div>}
      <div className="row gap10" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div className="td-sub" style={{ fontWeight: 600 }}>Filter dates</div>
        <div style={{ width: 160, maxWidth: '100%' }}><TextInput value={fromDate} onChange={setFromDate} type="date" size="sm" /></div>
        <span className="muted">to</span>
        <div style={{ width: 160, maxWidth: '100%' }}><TextInput value={toDate} onChange={setToDate} type="date" size="sm" min={fromDate || undefined} /></div>
        <Button size="sm" variant="primary" onClick={applyDateFilter} disabled={hasIncompleteRange || isLoading}>Apply</Button>
        {(fromDate || toDate || appliedDates.fromDate) && <Button size="sm" variant="ghost" onClick={() => { setFromDate(''); setToDate(''); setAppliedDates({}) }} disabled={isLoading}>Clear</Button>}
        {hasIncompleteRange && <span className="td-sub" style={{ color: 'var(--danger)' }}>Choose both dates.</span>}
      </div>
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

export function Settings({ section: controlledSection, onSectionChange }: {
  section?: SettingsSectionId
  onSectionChange?: (section: SettingsSectionId) => void
} = {}) {
  const { user } = useAuth()
  const visibleNav = SETTINGS_NAV.filter(s => canAccessSettingsSection(user, s.id))
  const [localSection, setLocalSection] = useState<SettingsSectionId>('store')
  const sec = controlledSection ?? localSection
  const setSec = (next: SettingsSectionId) => {
    if (controlledSection === undefined) setLocalSection(next)
    onSectionChange?.(next)
  }
  const { data: billingSettings } = useBillingSettingsQuery(sec === 'billing')
  const selected = visibleNav.find(item => item.id === sec) ?? visibleNav[0]

  useEffect(() => {
    if (visibleNav.length && !visibleNav.some(s => s.id === sec)) {
      setSec(visibleNav[0].id)
    }
  }, [user, visibleNav, sec])

  return (
    <div className="content-pad page-shell administration-page">
      <div className="administration-layout">
        <main className="administration-stage">
          {selected && <div className="admin-stage-heading"><div><h2>{selected.label}</h2><p>{selected.description}</p></div></div>}
          {sec === 'store' && canAccessSettingsSection(user, 'store') && <StoreProfile />}
          {sec === 'billing' && canAccessSettingsSection(user, 'billing') && (
            <>
              <BillingSettings />
              {billingSettings?.taxEnabled && <div style={{ marginTop: 16 }}><GstSchemeSettings /></div>}
            </>
          )}
          {sec === 'printer' && canAccessSettingsSection(user, 'printer') && <PrinterSettings />}
          {sec === 'backups' && canAccessSettingsSection(user, 'backups') && <BackupSettings />}
          {sec === 'users' && canAccessSettingsSection(user, 'users') && <UserManagement />}
          {sec === 'modules' && canAccessSettingsSection(user, 'modules') && <ModuleAccessSettings />}
          {sec === 'shifts' && canAccessSettingsSection(user, 'shifts') && <ShiftHistory />}
          {sec === 'audit' && canAccessSettingsSection(user, 'audit') && <AuditLog />}
        </main>
      </div>
    </div>
  )
}
