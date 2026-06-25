'use client'

import { MercantileMark } from '@/components/brand/MercantileMark'

/** Full-screen sign-in / app boot loader */
export function MercantileLoaderStage() {
  return (
    <div className="al-stage">
      <div className="al-icon">
        <MercantileMark height={51} />
      </div>
      <div className="al-nm font-brand">Mercantile</div>
      <div className="al-bar"><span /></div>
    </div>
  )
}

/** In-page loader for tables, cards, drawers */
export function ContentLoader({
  label = 'Loading…',
  compact = false,
}: {
  label?: string
  compact?: boolean
}) {
  const markH = compact ? 28 : 34
  return (
    <div className={'content-loader-wrap' + (compact ? ' compact' : '')}>
      <div className={'content-loader' + (compact ? ' compact' : '')}>
        <div className="cl-icon">
          <MercantileMark height={markH} />
        </div>
        <p className="cl-label">{label}</p>
        <div className="cl-bar" aria-hidden="true"><span /></div>
      </div>
    </div>
  )
}

export function BrandedLoader() {
  return (
    <div className="auth-loader">
      <MercantileLoaderStage />
    </div>
  )
}
