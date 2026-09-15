import React from 'react'

import { serializeJsonLd } from './jsonLd'

/**
 * Serverom vykreslený `<script type="application/ld+json">`.
 *
 * Jediné miesto, kde sa JSON-LD dostáva do HTML — tým pádom aj jediné miesto,
 * kde treba riešiť escapovanie (`serializeJsonLd`).
 */
export const JsonLd: React.FC<{ data: unknown }> = ({ data }) => (
  <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} type="application/ld+json" />
)
