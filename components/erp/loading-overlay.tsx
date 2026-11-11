import styles from './module-hub.module.css'

export function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className={styles.loadingOverlay} role="status" aria-live="polite" aria-label="Opening module">
      <span className={styles.spinner} aria-hidden="true" />
      <span>Please wait...</span>
    </div>
  )
}
