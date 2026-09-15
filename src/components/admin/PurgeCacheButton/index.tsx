'use client'

import React, { useState } from 'react'

/**
 * Sidebar tlačidlo v Nastaveniach webu: jedným klikom zmaže dátovú aj route
 * cache storefrontu (POST /api/admin/purge-cache). Použi, keď sa zmena z
 * administrácie neprejaví na webe — typicky prepnutie režimu Coming soon.
 */
export function PurgeCacheButton() {
  const [state, setState] = useState<'error' | 'idle' | 'ok' | 'working'>('idle')

  const purge = async () => {
    setState('working')
    try {
      const res = await fetch('/api/admin/purge-cache', {
        credentials: 'include',
        method: 'POST',
      })
      setState(res.ok ? 'ok' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="field-type" style={{ marginBottom: '1.5rem' }}>
      <button
        className="btn btn--style-secondary btn--size-medium"
        disabled={state === 'working'}
        onClick={purge}
        style={{ width: '100%' }}
        type="button"
      >
        {state === 'working' ? 'Mažem cache…' : 'Vymazať cache webu'}
      </button>
      <div style={{ fontSize: '0.75rem', marginTop: '0.4rem', opacity: 0.8 }}>
        {state === 'ok' && 'Hotovo — web sa pri najbližšom načítaní vyrenderuje nanovo.'}
        {state === 'error' && 'Nepodarilo sa — skúste znova alebo skontrolujte prihlásenie.'}
        {(state === 'idle' || state === 'working') &&
          'Použite, ak sa zmena (napr. režim Coming soon) neprejaví na webe.'}
      </div>
    </div>
  )
}
