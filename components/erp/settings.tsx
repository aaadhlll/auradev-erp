'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon, Button, Badge, Avatar, Field, TextInput, Select, Segmented, Switch, Modal, Card, IconTile, useToast } from './ui'
import { updateStoreProfile, uploadStoreLogo, resolveLogoUrl, updatePrinterSettings, updateBillingSettings, updateTaxSettings, type GstScheme } from '@/lib/settings-api'
import {
  useStoreProfileQuery,
  useInvalidateStoreProfile,
  usePrinterSettingsQuery,
  useInvalidatePrinterSettings,
  useBillingSettingsQuery,
  useInvalidateBillingSettings,
  useTaxSettingsQuery,
  useInvalidateTaxSettings,
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

export const SETTINGS_NAV: { id: SettingsSectionId; label: string; description: string; icon: string }[] = [
  { id: 'store', label: 'Store profile', description: 'Identity, contact and receipt details', icon: 'store' },
  { id: 'billing', label: 'Billing & POS', description: 'Checkout rules, discounts and tax', icon: 'scan-line' },
  { id: 'printer', label: 'Receipt output', description: 'Printer, copies and print behavior', icon: 'printer' },
  { id: 'users', label: 'Team access', description: 'Users, roles and sign-in access', icon: 'users' },
  { id: 'modules', label: 'Module access', description: 'Choose workspaces for every role', icon: 'layout-grid' },
  { id: 'audit', label: 'Activity log', description: 'Review important system events', icon: 'scroll-text' },
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
      })
      invalidate()
      toast('Billing settings saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save billing settings', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const toggleRows: { key: 'allowHoldBill' | 'allowCreditSales' | 'taxEnabled' | 'showCashierOnReceipt' | 'showGstBreakupOnReceipt' | 'showCustomerOnReceipt' | 'roundTotalToRupee'; title: string; sub: string }[] = [
    { key: 'allowHoldBill', title: 'Allow bill hold', sub: 'Cashiers can park carts as held bills' },
    { key: 'allowCreditSales', title: 'Allow credit (khata) sales', sub: 'Registered customers can pay on credit at POS' },
    { key: 'taxEnabled', title: 'Enable tax calculation', sub: 'Turn on only when tax applies to this store' },
    { key: 'showCashierOnReceipt', title: 'Show cashier on receipt', sub: 'Prints cashier name on bills' },
    { key: 'showCustomerOnReceipt', title: 'Show customer on receipt', sub: 'Customer name on printed bill' },
    { key: 'roundTotalToRupee', title: 'Round grand total to rupee', sub: 'Drop paise on final total' },
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
          <div className="form-field-narrow">
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
  const { data: profile } = useStoreProfileQuery()
  const { data: billingSettings } = useBillingSettingsQuery()
  const selected = visibleNav.find(item => item.id === sec) ?? visibleNav[0]

  useEffect(() => {
    if (visibleNav.length && !visibleNav.some(s => s.id === sec)) {
      setSec(visibleNav[0].id)
    }
  }, [user, visibleNav, sec])

  return (
    <div className="content-pad page-shell administration-page">
      <header className="admin-page-heading">
        <div>
          <div className="section-title">Settings</div>
          <div className="section-sub">Configure {profile?.name ?? 'your store'}{profile?.tenantId ? <> · Tenant <span className="mono">{profile.tenantId.slice(0, 8)}</span></> : null}</div>
        </div>
        {user?.role && <Badge tone="primary">{formatRoleLabel(user.role)}</Badge>}
      </header>
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
          {sec === 'users' && canAccessSettingsSection(user, 'users') && <UserManagement />}
          {sec === 'modules' && canAccessSettingsSection(user, 'modules') && <ModuleAccessSettings />}
          {sec === 'audit' && canAccessSettingsSection(user, 'audit') && <AuditLog />}
        </main>
      </div>
    </div>
  )
}
