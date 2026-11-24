'use client'

import { useState } from 'react'
import { Icon, Button, Modal, TextInput, Field, Select } from './ui'
import { createCustomer } from '@/lib/billing-api'

export function CustomerFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (customerId: string) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState<'b2c' | 'b2b'>('b2c')
  const [gstin, setGstin] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Customer name is required')
      return
    }
    setBusy(true)
    try {
      const created = await createCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
        type,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
      })
      onSaved(created.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add customer')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Add customer"
      sub="Register a customer for credit sales and parked bills"
      icon="user-round"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" icon="plus" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : 'Add customer'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="alert-banner danger" style={{ marginBottom: 14 }}>
          <Icon name="alert-circle" size={16} />
          <span>{error}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. Ramesh Kumar" autoFocus />
        </Field>
        <div className="row gap12 form-row align-start" style={{ flexWrap: 'wrap' }}>
          <div className="form-field-half">
            <Field label="Phone" optional>
              <TextInput value={phone} onChange={setPhone} placeholder="9448123456" />
            </Field>
          </div>
          <div className="form-field-half">
            <Field label="Type" required>
              <Select
                width="100%"
                value={type}
                onChange={v => setType(v as 'b2c' | 'b2b')}
                options={[
                  { value: 'b2c', label: 'Retail (B2C)', icon: 'user-round' },
                  { value: 'b2b', label: 'Business (B2B)', icon: 'building-2' },
                ]}
              />
            </Field>
          </div>
        </div>
        {type === 'b2b' && (
          <Field label="GSTIN" optional>
            <TextInput value={gstin} onChange={setGstin} placeholder="29AABCS1234F1Z5" />
          </Field>
        )}
        <Field label="Delivery address" optional hint="Saved for deliveries and printed on the customer receipt">
          <textarea
            className="bare"
            value={address}
            onChange={event => setAddress(event.target.value)}
            placeholder="Building, street, area, city"
            maxLength={500}
            rows={3}
          />
        </Field>
      </div>
    </Modal>
  )
}
