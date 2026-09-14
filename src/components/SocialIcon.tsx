import type { SocialPlatform } from '@/lib/navigation'

import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react'
import React from 'react'

/**
 * Icon for a social platform picked in the `footer` global.
 *
 * Closed map, kept in lockstep with `SOCIAL_PLATFORM_LABELS`
 * (src/lib/navigation.ts) — an unknown platform renders nothing rather than
 * throwing. No hooks, so it works from server and client components alike.
 */
const REGISTRY: Record<SocialPlatform, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  twitter: Twitter,
  youtube: Youtube,
}

type Props = {
  className?: string
  platform: SocialPlatform
}

export const SocialIcon: React.FC<Props> = ({ className, platform }) => {
  const Icon = REGISTRY[platform]

  if (!Icon) return null

  return <Icon className={className} />
}
