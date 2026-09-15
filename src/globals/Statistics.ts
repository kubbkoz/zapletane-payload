import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Štatistiky (Z8) — stránka s prehľadom predaja v skupine „Ecommerce“.
 *
 * Prečo global a nie vlastná admin route?
 * ---------------------------------------
 * Payload 3.89 vie do bočnej navigácie pridať položku len pre kolekciu alebo
 * global; `admin.components.views` na úrovni configu vyrobí route, ale nie
 * odkaz v menu (a už vôbec nie v konkrétnej skupine). Global je preto najmenej
 * prekvapivý spôsob, ako dostať „Štatistiky“ do skupiny Ecommerce: Payload
 * vyrobí natívnu položku `#nav-global-statistiky` (ikonu jej dáva §7 v
 * src/app/(payload)/custom.scss) a my nahradíme jej edit view vlastným
 * serverovým komponentom.
 *
 * Global žiadne dáta nedrží. `_placeholder` existuje len preto, že Payload
 * odmietne global bez jediného poľa; je skryté, takže ho nikto nikdy neuvidí.
 * Tabuľka `statistiky`, ktorú preto databáza dostane, zostane prázdna.
 *
 * Prístup:
 *   - `read: adminOnly`  — riadi aj to, či sa položka vôbec objaví v navigácii
 *     (Payload skladá menu z `permissions.globals[slug].read`).
 *   - `update: () => false` — stránka je čisto na čítanie. Nahradený root view
 *     nemá tlačidlo Uložiť, ale REST/GraphQL/MCP zápis by inak zostal otvorený.
 */
export const Statistics: GlobalConfig = {
  slug: 'statistiky',
  label: 'Štatistiky',
  access: {
    read: adminOnly,
    update: () => false,
  },
  admin: {
    components: {
      views: {
        edit: {
          // `root` = nahradenie CELÉHO dokumentového view vrátane hlavičky,
          // záložiek a ovládacích tlačidiel (payload/dist/config/types.d.ts →
          // `EditConfigWithRoot`). Iné kľúče (`default`, `api`, …) sa s ním
          // kombinovať nedajú a ani netreba — ukladať sa tu nemá čo.
          root: {
            Component: '@/components/admin/StatsView#StatsView',
          },
        },
      },
    },
    description:
      'Prehľad predaja: tržby, objednávky, výkon produktov a kategórií. Údaje sa prepočítavajú každých 5 minút.',
    group: 'Ecommerce',
  },
  fields: [
    {
      name: '_placeholder',
      type: 'text',
      admin: {
        disableListColumn: true,
        hidden: true,
      },
      label: 'Nepoužité',
    },
  ],
}
