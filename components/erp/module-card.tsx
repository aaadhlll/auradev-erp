import type { CSSProperties } from 'react'
import type { MercantileModule } from '@/lib/modules'
import { Icon } from './ui'
import styles from './module-hub.module.css'

export function ModuleCard({ module, index, onSelect }: {
  module: MercantileModule
  index: number
  onSelect: (module: MercantileModule) => void
}) {
  return (
    <button
      type="button"
      className={[styles.card, styles[module.tone]].join(' ')}
      style={{ '--card-index': index } as CSSProperties}
      onClick={() => onSelect(module)}
    >
      <span className={styles.cardIcon}><Icon name={module.icon} size={20} /></span>
      <span className={styles.cardCopy}>
        <strong>{module.label}</strong>
        <small>{module.description}</small>
      </span>
    </button>
  )
}
