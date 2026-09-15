import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Importy z webu — jedna úloha = jeden zdrojový e-shop (Z12).
 *
 * Dokument je zároveň *formulár* (adresa, kurz, veľkosť dávky) aj *stav
 * behu* (fronta adries, kurzor, počítadlá, log). Držať oboje pokope je
 * zámerné: import beží po dávkach, každá dávka je samostatné volanie API a
 * medzi dvomi dávkami neexistuje žiadna pamäť procesu — jediné, čo prežije,
 * je tento dokument. Stav v Redise či v pamäti by sa po nasadení stratil
 * uprostred importu.
 *
 * Postup, ktorý si majiteľka odklikáva v bočnom paneli („Ovládanie importu"):
 *
 *   1. „nový" — zadá adresu obchodu a uloží.
 *   2. „Spustiť testovací beh" → route `/api/scraper/run` s `mode: 'preview'`.
 *      Nájde produkty, prvé tri stiahne, preloží a prepočíta ceny, uloží ich
 *      do `previews` a prepne stav na „čaká na potvrdenie". NIČ neimportuje.
 *   3. Majiteľka si náhľady prezrie a buď potvrdí, alebo úlohu zahodí.
 *   4. „Potvrdiť a importovať všetko" → tá istá route s `mode: 'batch'`,
 *      volaná v slučke z prehliadača, kým stav nie je „hotovo" alebo „chyba".
 *
 * Prečo slučku riadi prehliadač a nie server: serverless funkcia má strop
 * 60 s, import stoviek produktov trvá desiatky minút. Jedna dávka = jedno
 * volanie, ktoré sa určite stihne; opakovanie je vec klienta, ktorý navyše
 * môže kedykoľvek zastaviť.
 */
export const ScraperJobs: CollectionConfig = {
  slug: 'scraper-jobs',
  access: {
    create: adminOnly,
    delete: adminOnly,
    // Žiadne verejné čítanie: dokument obsahuje kompletnú mapu cudzieho
    // e-shopu aj prevádzkový log. Pre návštevníka nemá zmysel a pre
    // konkurenciu je to zbytočne veľa informácií.
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['sourceUrl', 'status', 'counters.imported', 'updatedAt'],
    description:
      'Stiahne produkty z ľubovoľného e-shopu, preloží ich do slovenčiny, prepočíta ceny na eurá a naimportuje. Najprv sa vždy spustí testovací beh — importuje sa až po potvrdení.',
    group: 'Ecommerce',
    useAsTitle: 'sourceUrl',
  },
  labels: {
    plural: 'Importy z webu',
    singular: 'Import z webu',
  },
  fields: [
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'Adresa obchodu',
      required: true,
      admin: {
        description:
          'Celá adresa vrátane https://, napr. https://wiklinowa-wies.pl/. Môže to byť domovská stránka, kategória aj jeden produkt.',
        placeholder: 'https://…',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          label: 'Stav',
          defaultValue: 'new',
          index: true,
          options: [
            { label: 'Nový', value: 'new' },
            { label: 'Testovací beh', value: 'preview_running' },
            { label: 'Čaká na potvrdenie', value: 'awaiting_confirm' },
            { label: 'Importuje sa', value: 'importing' },
            { label: 'Hotovo', value: 'done' },
            { label: 'Chyba', value: 'failed' },
          ],
          admin: {
            description: 'Mení sa sám podľa toho, čo práve beží.',
            width: '50%',
          },
        },
        {
          name: 'detectedLanguage',
          type: 'text',
          label: 'Rozpoznaný jazyk',
          admin: {
            description: 'Dvojpísmenový kód (pl, cs, de…). Pri „sk“ sa preklad preskočí.',
            readOnly: true,
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'fallbackRate',
          type: 'number',
          label: 'Záložný kurz',
          defaultValue: 4.3,
          min: 0.0001,
          admin: {
            description:
              'Koľko jednotiek cudzej meny za 1 €. Použije sa, keď sa nepodarí stiahnuť živý denný kurz (predvolené 4,3 PLN/€).',
            width: '33%',
          },
        },
        {
          name: 'batchSize',
          type: 'number',
          label: 'Veľkosť dávky',
          defaultValue: 5,
          max: 10,
          min: 1,
          admin: {
            description:
              'Koľko produktov sa naimportuje v jednom kroku. Viac než 10 sa do jedného volania nezmestí.',
            width: '33%',
          },
        },
        {
          name: 'maxProducts',
          type: 'number',
          label: 'Najviac produktov',
          defaultValue: 500,
          min: 1,
          admin: {
            description: 'Strop na počet produktov, ktoré sa z obchodu vôbec vezmú.',
            width: '33%',
          },
        },
      ],
    },
    {
      name: 'counters',
      type: 'group',
      label: 'Počítadlá',
      admin: {
        description: 'Priebeh importu. Aktualizuje sa po každej dávke.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'discovered',
              type: 'number',
              label: 'Nájdené',
              defaultValue: 0,
              admin: { readOnly: true, width: '25%' },
            },
            {
              name: 'imported',
              type: 'number',
              label: 'Naimportované',
              defaultValue: 0,
              admin: { readOnly: true, width: '25%' },
            },
            {
              name: 'skipped',
              type: 'number',
              label: 'Preskočené',
              defaultValue: 0,
              admin: { readOnly: true, width: '25%' },
            },
            {
              name: 'failed',
              type: 'number',
              label: 'Chyby',
              defaultValue: 0,
              admin: { readOnly: true, width: '25%' },
            },
          ],
        },
      ],
    },
    {
      name: 'controls',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/ScraperJobControls#ScraperJobControls',
        },
        position: 'sidebar',
      },
      label: 'Ovládanie importu',
    },
    {
      name: 'previewCards',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/ScraperJobPreviews#ScraperJobPreviews',
        },
      },
      label: 'Náhľad importu',
    },
    {
      name: 'previews',
      type: 'json',
      label: 'Náhľady z testovacieho behu',
      admin: {
        description:
          'Takto budú produkty vyzerať po importe. Vykresľuje ich panel „Ovládanie importu“ — surové dáta sú tu len na kontrolu.',
        readOnly: true,
      },
    },
    {
      name: 'log',
      type: 'textarea',
      label: 'Priebeh',
      admin: {
        description: 'Posledné riadky sú navrchu.',
        readOnly: true,
        rows: 14,
      },
    },
    {
      name: 'productLinks',
      type: 'json',
      label: 'Fronta adries',
      admin: {
        // Zoznam môže mať stovky položiek — v admine je zbytočný a v editore
        // JSON by len spomaľoval načítanie formulára.
        hidden: true,
      },
    },
    {
      name: 'cursor',
      type: 'number',
      label: 'Pozícia vo fronte',
      defaultValue: 0,
      admin: { hidden: true },
    },
  ],
}
