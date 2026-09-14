import type { PayloadMcpApiKey, User } from '@/payload-types'

// req.user can also be a PayloadMcpApiKey principal (MCP plugin auth collection);
// API keys carry no roles, so role checks correctly resolve to false for them.
export const checkRole = (
  allRoles: User['roles'] = [],
  user?: User | PayloadMcpApiKey | null,
): boolean => {
  if (user && 'roles' in user && allRoles) {
    return allRoles.some((role) => {
      return user.roles?.some((individualRole) => {
        return individualRole === role
      })
    })
  }

  return false
}
