import { Hand, Heart, Leaf, Package, Shield, Sparkles, Star, Truck } from 'lucide-react'
import React from 'react'

import { type ContentIconName, isContentIconName } from '@/lib/contentIcons'

/**
 * The single name → component map for editor-pickable icons.
 *
 * Kept in lockstep with `CONTENT_ICON_NAMES` (src/lib/contentIcons.ts), which is
 * what the admin UI offers. An unknown name renders nothing rather than
 * throwing, so a hand-edited / MCP-written value can never break a page.
 *
 * Plain function component with no hooks: usable from server and client
 * components alike.
 */
const REGISTRY: Record<ContentIconName, React.ElementType> = {
  Hand,
  Heart,
  Leaf,
  Package,
  Shield,
  Sparkles,
  Star,
  Truck,
}

type Props = {
  className?: string
  name?: null | string
  strokeWidth?: number
}

export const ContentIcon: React.FC<Props> = ({ className, name, strokeWidth }) => {
  if (!isContentIconName(name)) return null

  const Icon = REGISTRY[name]

  return <Icon className={className} strokeWidth={strokeWidth} />
}
