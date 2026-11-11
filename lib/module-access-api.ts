import { apiFetch } from './api'
import type { ModuleId } from './modules'
import type { UserRole } from './users-api'

export interface ModuleAccessMatrix {
  roles: Partial<Record<UserRole, string[]>>
}

export async function fetchMyModules(): Promise<ModuleId[]> {
  const modules = await apiFetch<string[]>('/api/v1/settings/module-access/me')
  return modules.map(module => module.toLowerCase() as ModuleId)
}

export async function fetchModuleAccess(): Promise<ModuleAccessMatrix> {
  return apiFetch<ModuleAccessMatrix>('/api/v1/settings/module-access')
}

export async function updateModuleAccess(roles: Partial<Record<UserRole, ModuleId[]>>): Promise<ModuleAccessMatrix> {
  const payload = Object.fromEntries(
    Object.entries(roles).map(([role, modules]) => [role, modules?.map(module => module.toUpperCase()) ?? []]),
  )
  return apiFetch<ModuleAccessMatrix>('/api/v1/settings/module-access', {
    method: 'PUT',
    body: JSON.stringify({ roles: payload }),
  })
}
