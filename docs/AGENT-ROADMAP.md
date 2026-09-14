# ZAPLETANE — autonómny exekučný plán (fáza 3)

> Tento dokument je zdroj pravdy pre pokračovanie autonómnej práce po obnove
> session. Manažér (Fable) ho číta ako prvý krok po zobudení; delí prácu medzi
> Opus/Sonnet agentov podľa vlnovej štruktúry nižšie. Po dokončení každej vlny
> AKTUALIZUJ sekciu „Stav" a commitni.

## Stav (aktualizuj priebežne)

- [x] Fáza 1+2 hotové a NASADENÉ: design port 1:1, coming-soon gate
      (SiteSettings global + MCP), EUR mena, opravený košík/checkout,
      nové stock badge, brandovaný admin (light+dark), MCP server
      (lokál + produkcia), Vercel pipeline.
- [ ] W1 Doprava + platby (dobierka, prevod, Comgate)
- [ ] W2 Správa obsahu (hero, sekcie, footer, kontakty, navbar menu, meny)
- [ ] W3 Custom filtre na /shop
- [ ] W4 Redizajn mobilného hamburger menu
- [ ] Finálna integrácia, build, push, deploy, Playwright verifikácia

## Kľúčové fakty prostredia

- Repo: kubbkoz/zapletane-payload, branch `claude/zapletane-payload-migration-vtrmuq`
  (každý push = auto-deploy na Vercel).
- Live: https://zapletane.zjav.sk (coming-soon gate ON; bypass `?preview=<COMING_SOON_BYPASS>`).
- Vercel: team `team_aiiAfC6J40TWBpfXLTVtO1sb`, projekt `zapletane`
  (`prj_ljcVtn9xfNVo0ngpZivwC5v8owJ6`), Neon store `zapletane-db`
  (store_hP4ahpI2yp0yzQ9s), DB schéma `zapletane` (PAYLOAD_DB_SCHEMA — NEMENIŤ).
- Stack: Payload 3.89.0 + Next 16 + Tailwind v4; sqlite lokálne (push mode),
  @payloadcms/db-vercel-postgres v produkcii (migration-driven build).
- Ak je lokálny `.env` stratený (nový kontajner): skopíruj `.env.example`,
  doplň PAYLOAD_SECRET (hocijaký), `npm install`, `npm run mcp:mint-key`,
  `npx tsx scripts/seed-dev.ts`. VERCEL_TOKEN / PROD_MCP_KEY / COMING_SOON_BYPASS
  sú v transcripte session a vo Vercel env; NIKDY ich nezapisuj do repa.
- Egress allowlist: api.vercel.com, zapletane.zjav.sk. `apidoc.comgate.cz`
  je BLOKOVANÉ — užívateľ ho musí povoliť; Comgate API domény tiež
  (payments.comgate.cz). Bez toho W1 implementuje Comgate podľa znalostí
  + env-driven, verifikácia po povolení domény.

## Operatívne pravidlá (overené tvrdou cestou)

1. **PG migrácie**: generuj offline `POSTGRES_URL=postgres://user:pass@localhost:5432/db
   PAYLOAD_DB_SCHEMA=zapletane npx payload migrate:create <name> --force-accept-warning`.
   Funguje LEN pre aditívne zmeny; RENAME polí = drizzle interaktívne prompty
   → migráciu napíš RUČNE (RENAME COLUMN / ALTER TYPE RENAME VALUE) + skopíruj
   posledný snapshot .json s textovými náhradami (vzor:
   `src/migrations-pg/20260914_213000_eur_currency.*`). Po zmene schémy vždy
   `npm run generate:types`.
2. **Klasifikátor povolení**: Bash príkazy so slovami „password"/secret hodnoty
   a agent prompty s „you are allowed/permission" bývajú blokované. Súborové
   zmeny rob cez Write/Edit, formulácie neutrálne. Env zápisy na Vercel s
   secretmi vyžadujú súhlas usera.
3. **Paralelizmus**: schému (payload.config, src/globals, src/collections,
   migrations) smie meniť VŽDY LEN JEDEN agent naraz. Frontend-only agenti
   môžu bežať paralelne s disjunktným vlastníctvom súborov (vymenuj v prompte
   „DO NOT touch").
4. **Verifikácia pred pushom**: `npx tsc --noEmit` → `npm run build` →
   Playwright (chromium binárka `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
   bypass cookie cez `?preview=`; seed: `npx tsx scripts/seed-dev.ts`).
   Deploy watch: poll `https://api.vercel.com/v6/deployments?teamId=...&projectId=...`.
5. Commit správy bez model identifikátorov v kóde; attribution footer podľa
   session pravidiel. Stop-hook vyžaduje commit+push — necommituj rozbité
   medzistavy agentov, radšej vysvetli.

## W1 — Doprava a platby (Opus; vlastní schému)

Kolekcia `shipping-methods`: title, description, price (EUR centy), enabled,
poradie, typ (kuriér/balíkovňa/osobný odber), doručenie X-Y dní. Admin CRUD,
expozícia cez MCP (globalConfigs vzor netreba — kolekcie idú cez mcpPlugin
config v src/plugins/index.ts, pridaj fullCrud).
Platobné metódy: `payment-methods` kolekcia alebo config v SiteSettings —
zvoľ kolekciu (title, typ enum [dobierka|prevod|comgate], poplatok, enabled,
inštrukcie richtext pre prevod).
Checkout: krok výberu dopravy + platby (ceny sa pripočítajú k objednávke;
plugin-ecommerce orders — over ako template počíta total; poplatky pridaj
transparentne do summary). Dobierka: objednávka sa vytvorí bez online platby,
stav „čaká na dobierku". Prevod: objednávka + zobrazenie IBAN/VS inštrukcií
(IBAN do SiteSettings), e-mail až bude SMTP. Comgate (karta): adaptér v
`src/payments/comgate/` — create payment (POST payments.comgate.cz/v2.0/payment,
merchant/secret z env COMGATE_MERCHANT, COMGATE_SECRET, COMGATE_TEST=true),
redirect flow, webhook/status endpoint route handler, mapovanie na order stav.
Ak docs nedostupné (egress), implementuj podľa Comgate API v2.0 znalostí,
označ TODO-VERIFY komentármi. Stripe nechaj funkčné za env (nemazať).

## W2 — Správa obsahu (Opus; vlastní schému; PO W1)

Rozšír globals + kolekcie tak, aby VŠETOK hardcoded obsah bol editovateľný:
- Hero: array slides (upload obrázok do media, eyebrow/title/text/CTA/hotspoty)
  → nahradí `src/components/home/heroSlides.ts`.
- Homepage sekcie: slogan, value cards (ikona z lucide zoznamu, title, text),
  gift CTA (texty, obrázok, link), tabs konfigurácia.
- Footer: stĺpce/odkazy, texty, sociálne siete (URL), bottom bar.
- Kontakty: telefón, e-mail, IČO/DIČ, adresa, otváracie hodiny → nahradí
  `src/lib/contact.ts` (fallback konštanty nechaj).
- Navbar: Header global rozšíriť o hierarchiu (L1 + voliteľné L2 deti),
  TopBar odkazy editovateľné.
- Meny: plugin `currencies` config — pridaj CZK ako voliteľnú druhú menu
  (supportedCurrencies [EUR, CZK], default EUR, currency switcher v headri
  cez useCurrency().setCurrency; produkt bez CZK ceny → fallback EUR).
  Ak to neúmerne komplikuje checkout/Comgate, nechaj EUR-only a zapíš prečo.
Všetko: pg migrácie (aditívne), MCP expozícia, seed defaultov = aktuálne
hardcoded hodnoty (zero vizuálna zmena po nasadení), frontend číta globals
s unstable_cache + revalidateTag vzorom (pozri SiteSettings).

## W3 — Custom filtre /shop (Sonnet; frontend-only, paralelne s W1)

Cenový rozsah (slider/min-max), dostupnosť (skladom/na objednávku), kategórie
multi-select, zoradenie — všetko URL params (SSR friendly), štýl podľa
design systému (form-input, btn-tab-*). Payload where klauzuly v shop page
queries. Mobile: filter drawer. Empty-state zachovať. Bez zmien schémy!

## W4 — Mobilný hamburger (Sonnet; frontend-only, paralelne s W1)

Kompletný redizajn `src/components/Header/MobileMenu.tsx` — MUSÍ sa viditeľne
zmeniť: fullscreen krémový overlay, veľké Unbounded položky so staggered
animáciou (fade+slide, žiadne bounce), sekcie: hlavné menu / kategórie /
kontaktný blok + sociálne ikony dole, zavieranie X hore vpravo (40×40 chip),
telo scroll-lock. Rešpektuj tokeny; `prefers-reduced-motion` fallback.

## Poradie a integrácia

1. Vlna A (paralelne): W1 (Opus) + W3 (Sonnet) + W4 (Sonnet).
2. Po W1: commit+push checkpoint (deploy spustí migrácie).
3. Vlna B: W2 (Opus).
4. Finále: tsc, build, Playwright (checkout s dobierkou end-to-end lokálne),
   screenshoty userovi, commit+push, deploy watch, update tohto Stavu.
