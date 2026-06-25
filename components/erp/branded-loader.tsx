'use client'

import { MercantileMark } from '@/components/brand/MercantileMark'

export function BrandedLoader() {
  return (
    <div className="auth-loader">
      <div className="al-stage">
        <div className="al-icon">
          <MercantileMark height={51} />
        </div>
        <div className="al-nm font-brand">Mercantile</div>
        <div className="al-bar"><span /></div>
      </div>
    </div>
  )
}
