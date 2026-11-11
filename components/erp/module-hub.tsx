'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MercantileMark } from '@/components/brand/MercantileMark'
import { MERCANTILE_MODULES, type MercantileModule } from '@/lib/modules'
import { canAccessView } from '@/lib/rbac'
import { useAuth } from '@/lib/auth-context'
import { Icon } from './ui'
import { NotificationBell } from './shell'
import { useTheme } from '@/lib/theme'
import { ModuleCard } from './module-card'
import { LoadingOverlay } from './loading-overlay'
import styles from './module-hub.module.css'

export function ModuleHub() {
  const router = useRouter()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [loading, setLoading] = useState(false)
  const modules = MERCANTILE_MODULES.filter(module => module.views.some(view => canAccessView(user, view)))

  function openModule(module: MercantileModule) {
    if (loading) return
    setLoading(true)
    window.setTimeout(() => router.push(module.route), 700)
  }

  return (
    <main className={styles.hub}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}><MercantileMark height={17} /></span>
          <span className="font-brand">Mercantile</span>
        </div>
        <div className={styles.actions}>
          <NotificationBell />
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
        </div>
      </header>

      <section className={styles.content} aria-labelledby="hub-title">
        <div className={styles.intro}>
          <div>
            <h1 id="hub-title">Hey there,</h1>
            <p>Welcome to Mercantile ERP Dashboard!</p>
          </div>
          <button type="button" className={styles.support}>Need support?</button>
        </div>
        <div className={styles.grid}>
          {modules.map((module, index) => (
            <ModuleCard key={module.id} module={module} index={index} onSelect={openModule} />
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>© 2026, AuraDev. All Rights Reserved.</span>
        <nav aria-label="Legal links">
          <a href="#contact">Contact AuraDev</a><a href="#privacy">Privacy</a>
          <a href="#terms">Terms of use</a><a href="#trademarks">Trademarks</a>
        </nav>
      </footer>
      <LoadingOverlay visible={loading} />
    </main>
  )
}
