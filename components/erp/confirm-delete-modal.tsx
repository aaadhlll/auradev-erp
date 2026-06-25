'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import { Modal, Button, Field, TextInput } from './ui'

export function ConfirmDeleteModal({
  open,
  title,
  sub,
  confirmText = 'DELETE',
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean
  title: string
  sub?: string
  /** User must type this exactly (case-sensitive). */
  confirmText?: string
  onClose: () => void
  onConfirm: () => void | Promise<void>
  busy?: boolean
}) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  if (!open) return null

  const canConfirm = typed === confirmText

  return (
    <Modal
      title={title}
      sub={sub}
      icon="alert-triangle"
      iconTone="tile-warning"
      onClose={busy ? () => {} : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="danger"
            icon="trash-2"
            disabled={!canConfirm || busy}
            onClick={() => void onConfirm()}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      )}
    >
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 14, lineHeight: 1.55 }}>
        This cannot be undone. Type <span className="mono" style={{ fontWeight: 700, color: 'var(--fg)' }}>{confirmText}</span> below to confirm.
      </p>
      <Field label={`Type ${confirmText} to confirm`}>
        <TextInput
          value={typed}
          onChange={setTyped}
          placeholder={confirmText}
          autoFocus
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && canConfirm && !busy) void onConfirm()
          }}
        />
      </Field>
    </Modal>
  )
}
