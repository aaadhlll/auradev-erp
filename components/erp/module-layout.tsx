import type { ReactNode } from 'react'

export function ModuleLayout({ sidebar, topbar, children, backdrop }: {
  sidebar: ReactNode
  topbar: ReactNode
  children: ReactNode
  backdrop?: ReactNode
}) {
  return <div className="app">{backdrop}{sidebar}<div className="main">{topbar}{children}</div></div>
}
