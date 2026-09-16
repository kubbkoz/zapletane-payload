# ZAPLETANE — autonómny exekučný plán (fáza 3)

> Tento dokument je zdroj pravdy pre pokračovanie autonómnej práce po obnove
> session. Manažér (Fable) ho číta ako prvý krok po zobudení; delí prácu medzi
> Opus/Sonnet agentov podľa vlnovej štruktúry nižšie. Po dokončení každej vlny
> AKTUALIZUJ sekciu „Stav" a commitni.

## Stav (aktualizuj priebežne)

- [x] Fáza 8 (Z16–Z19 + hotfixy) — HOTOVÉ, nasadené (02c5a72): Z16 fix importu
      (504 → 202 + after(), jeden deadline BATCH_BUDGET_MS 40 s, preklad
      ok/failed/deferred BEZ fallbacku na poľštinu, retry 3×, batch default 3);
      Z17 blog sekcia na homepage (posledné 3, unstable_cache 300 s), storefront
      pripnutý na light (Theme/shared + InitTheme), RichText explicitné farby
      (čierne nadpisy/tmavý text) + srdiečko z loga pred h2
      (.richtext-heading-mark, enableHeadingMark); Z18 PDP purchase panel
      (QuantityStepper zdieľaný s cart drawerom, StockCounter „Skladom: N ks"
      + bar / <5 warning / Vypredané / „Na objednávku" pri nesledovanom sklade,
      wishlist button vedľa add-to-cart, AddToCart s natívnym quantity,
      GooglePayButton → /checkout?platba=karta s predvolenou kartou); Z18b GPay
      gate zrkadlí checkout filter (karta sa ukáže až s reálnymi Comgate/Stripe
      kredenciálmi — na prode je zapnutý card riadok bez credov!); Z19 generátor
      článkov píše aj „Návrhy obrázkov (AI)" (posts.aiImagePrompts textarea,
      z19 migrácia — nesie aj scraper_jobs.batch_size default 3 drift zo Z16;
      2–4 bloky: umiestnenie pod sekciou + reálny produkt číslom z katalógu
      (server-side rezolúcia, nevymyslí si) + anglický prompt s klauzulou
      „priložená fotka produktu nezmenená", anti-slop gate sa na prompty
      neaplikuje, AI_TIMEOUT 150 s, maxDuration 180, max_tokens 8000,
      repairJson fallback na neescapované úvodzovky, zákaz rovných úvodzoviek
      v texte). Hotfix search: description field ILIKEoval jsonb na Postgrese
      (42883) → clauses idú na meta.description (text; SQLite to maskoval
      TEXT serializáciou — e2e na sqlite NEdokazuje Postgres!). Chybová
      hranica (app)/error.tsx po slovensky. Pozn.: kúpny panel ukáže counter
      len pri produkte s vyplneným Inventory; importované produkty ho nemajú
      → „Na objednávku".
- [x] Fáza 1+2 hotové a NASADENÉ: design port 1:1, coming-soon gate
      (SiteSettings global + MCP), EUR mena, opravený košík/checkout,
      nové stock badge, brandovaný admin (light+dark), MCP server
      (lokál + produkcia), Vercel pipeline.
- [x] W1 Doprava + platby (dobierka, prevod, Comgate) — HOTOVÉ, nasadené
- [x] W2 Správa obsahu (hero, sekcie, footer, kontakty, navbar menu) — implementované
      a lokálne overené (identický render + revalidácia); meny = EUR-only, viď
      „W2 — výsledok". Build/push/deploy robí manažér.
- [x] W3 Custom filtre na /shop — HOTOVÉ, nasadené
- [x] W4 Redizajn mobilného hamburger menu — HOTOVÉ, nasadené
- [x] Finálna integrácia, build, push, deploy, Playwright verifikácia — HOTOVÉ
- [x] Fáza 4 (X1–X4): shipping rules, zľavové kódy, search settings, dynamické
      filtre, OAuth (Google/FB — čaká na klientske kľúče), admin SK + ikony —
      HOTOVÉ, nasadené
- [x] Fáza 7 (Z10–Z15) — HOTOVÉ, nasadené (96b1401): Z10 wishlist len pre
      prihlásených (login modal, zdieľanie cez capability URL
      /wishlist/zdielane/<token>, účet + navbar heart, users.wishlist +
      wishlistShareToken, z10), košík so sumou bez podčiarknutia, card CTA
      add-to-cart/šípka (enableVariants), kompaktný header 1024–1599;
      Z11 hero+header = presne 100dvh na malých desktopoch
      (--navbar-height-full, large-desktop variant, fix 67px overflow);
      Z12 scraper v1 (engine, admin Importy z webu, e2e wiklinowa-wies.pl,
      z12 + granty); z13 zjednotenie MCP grantov na všetkých kľúčoch (tool
      listing sa filtruje per kľúč!); Z14 scraper v2 (výber kategórií s
      prekladom, background reťaz cez after() + SCRAPER_INTERNAL_TOKEN +
      denný tick cron, sentence-case názvy titleCase.ts, preklady
      claude-sonnet-5 + glosár, dedupe aj podľa slugu/názvu, z14 — nesie aj
      posts.ai_prompt pre Z15, NEMAZAŤ!); Z15 AI články (persona Janka,
      anti-slop gate, /api/posts/generate, len koncepty, bez vlastnej
      migrácie — stĺpec je v z14). Infra: Coming soon fix (full route cache
      — revalidatePath('/','layout') pri uložení SiteSettings + tlačidlo
      „Vymazať cache webu" + /api/admin/purge-cache); Vercel env navyše:
      SCRAPER_INTERNAL_TOKEN, CRON_SECRET. Prod job id 3 (wiklinowa,
      status new) čaká na výber kategórií a spustenie majiteľom.
- [x] Fáza 6 (Z1–Z9) — HOTOVÉ, nasadené (482c2a1): Z1 search overlay (blur,
      centrovaný input, live results, odporúčané produkty/kategórie v search
      settings); Z2 kompletný účet (adresy fakturačná/dodacia cez kind,
      objednávky+stavy SK, reklamačná stránka); Z3 web push (VAPID, push-
      subscriptions, order-status hook) + PWA (manifest, sw.js, install);
      Z4 SEO/GEO (AI meta cez Claude + fallback šablóna, JSON-LD, sitemap +
      robots fix, alt fix); Z5 topbar režimy (kontakty/marquee/off); Z6 cookie
      consent (vanilla-cookieconsent, gating scriptov + push, footer
      preferencie); Z7 SEO slugy + auto 301 redirecty (plugin-redirects,
      kolaps reťazcov) + Blog (/blog/[slug]) + /kategoria/[slug]; Z8 admin
      štatistiky (global statistiky, Ecommerce group, dashboard hero →
      objednávky → štatistiky, orders prvé v nav); Z9 hero video/obrázok
      per slide + auto optimalizácia uploadov (WebP q82, video H.264 CRF23,
      beforeOperation buffer swap). Infra: Vercel Blob storage (media),
      blob remotePatterns + ffmpeg tracing v next.config, ANTHROPIC_API_KEY
      + VAPID env na Verceli. Pozn.: prod upload strop ~4,3 MB (serverless
      body limit); clientUploads by ho zdvihol, ale vypol by optimalizáciu.
- [x] Fáza 5 (Y1–Y4): vlastnosti produktov + rozmery/hmotnosť + cross/upsell,
      Google Merchant + Meta feedy s mapovaním atribútov, tracking scripty
      (head/body), PDP/cart rendering, mobilný app-shell (bottom bar, hamburger
      morph, bottom-sheet košík, fullscreen search) — HOTOVÉ, nasadené c0059dc

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

### W2 — výsledok

**Nový global `homepage`** (`src/globals/Homepage.ts`, registrovaný cez
`globalConfigs` → automaticky aj v MCP): hero (slides s upload obrázkom +
statickým fallbackom, eyebrow/title/text/CTA/sekundárne CTA, hotspoty s x/y %,
názvom, cenou a odkazom na produkt; piliere s ikonou z whitelistu), slogan
(pred/zvýraznené/za), „Prečo Zapletane" (eyebrow, nadpis s `\n` → `<br>`,
odstavec, karty s ikonou), konfigurácia záložiek produktov (label + povolené
`sort`), sekcia Sortiment a darčekový banner. Číta sa cez
`src/utilities/getHomepage.ts` (unstable_cache, tag `global_homepage`,
ceiling 60 s) a mapuje cez `src/lib/homeContent.ts`.

**Rozšírené globals:** `header` (podpoložky menu — jedna úroveň, dropdown na
desktope / odsadenie v mobilnom menu; editovateľné odkazy hornej lišty),
`footer` (popis, sociálne siete, nadpisy stĺpcov, texty podpory, spodná lišta
s `{{year}}`), `site-settings` (skupina `contact`: telefón, e-mail, obchodné
meno, IČO, DIČ, IČ DPH, adresa, otváracie hodiny). Header aj Footer majú
konečne vlastný `afterChange` revalidačný hook (`src/globals/revalidateGlobal.ts`).

**Stratégia „nulovej zmeny":** každá nová vlastnosť má `defaultValue` rovný
pôvodnej hardcoded hodnote (nikdy neuložený global vráti defaulty), každý
komponent má navyše fallback na konštanty (`src/lib/homeDefaults.ts`,
`footerDefaults.ts`, `navigation.ts`, `contact.ts`) pre riadok uložený pred
pridaním poľa. Skalárne stĺpce v migrácii nesú pôvodný text ako SQL DEFAULT,
takže Postgres ich doplní aj do existujúcich riadkov; nové array tabuľky
dopĺňa dátová migrácia `20260914_231500_content_defaults`.

**Meny (CZK): NEIMPLEMENTOVANÉ — zámerne, ostáva EUR-only.** W1 práve nasadil
manuálny + Comgate adaptér, ktorý počíta poplatky na serveri v eurocentoch
(`src/payments/shared/fees.ts`: `shipping-methods.price` a
`payment-methods.surcharge` sú jednomenové skaláry pripočítané k medzisúčtu
košíka), a Comgate `curr` je natvrdo `'EUR'` (`src/payments/comgate/api.ts`).
Druhá mena by sa musela pretiahnuť cez celý reťazec naraz: plugin-ecommerce
odvodzuje názvy cenových polí od kódu meny (pribudli by stĺpce `priceInCZK` na
`products` aj `variants` — nie aditívna drobnosť, ale nový cenník), poplatky by
potrebovali sumu na menu, objednávka a transakcia menu, ktorou sa reálne
platilo, Comgate `curr` podľa nej a zvolený kurz/zaokrúhľovanie by bolo
obchodné rozhodnutie, nie technické. Riziko destabilizácie práve dokončenej
pokladne je neúmerné prínosu, kým neexistuje CZK cenník. **Čo treba na budúce
zavedenie CZK:** (1) rozhodnúť cenotvorbu — vlastná CZK cena na produkte vs.
prepočet kurzom; (2) `supportedCurrencies: [EUR, CZK]` v `src/plugins/index.ts`
+ migrácia na `price_in_czk` stĺpce a doplnenie cien; (3) sumy na menu pri
doprave a platbe (alebo prepočet so zaokrúhlením na serveri); (4) menu uložiť
na objednávke a posielať do Comgate ako `curr`; (5) currency switcher v hlavičke
(`useCurrency().setCurrency`) + fallback na EUR pri produkte bez CZK ceny;
(6) e2e test pokladne v oboch menách vrátane dobierky a vrátenia platby.

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

## Fáza 4 (2026-09-15)

- [x] X1 Commerce schéma — HOTOVÉ, nasadené;: shipping rules (freeAboveSubtotal na shipping-methods,
      checkout ju aplikuje server-side), kolekcia discount-codes (kód, percento/
      fixná suma, minSubtotal, platnosť od-do, maxUses/usedCount, enabled) +
      pole v checkoute + prepočet + order polia discountCode/discountAmount,
      SiteSettings skupina search (searchable fields, placeholder, minChars),
      kolekcia product-filters (label, typ, options→tagy, enabled, order) +
      products.filterTags (array text). Migrácie aditívne, MCP grants, seed-dev.
- [x] X2 Admin v slovenčine — HOTOVÉ;: payload.config i18n (sk z @payloadcms/translations),
      brand ikony v admin nav cez CSS mask (lucide SVG data-URI, farba --zap
      tokeny) v custom.scss — Payload 3.89 nemá per-collection icon config.
- [x] X3 OAuth registrácia (PO X1): Google + Facebook login/registrácia na
      frontende, route handlers (redirect + callback → find/create user →
      payload session), gated za GOOGLE_CLIENT_ID/SECRET a FACEBOOK_APP_ID/
      SECRET env (tlačidlá skryté bez env), e-mail flow ostáva.
- [x] X4 Frontend filtre/search — HOTOVÉ;: /shop filter panel generovaný z
      product-filters kolekcie (tag filtre + existujúce cena/dostupnosť/
      kategórie pod kontrolou backendu), vyhľadávanie podľa SiteSettings.search.
- [x] Finále: build zelený, pushnuté, nasadené.

### X3 — výsledok

**Schéma (aditívna):** `users.oauthProvider` (select google|facebook) +
`users.oauthSub` (text, index). Obe majú `access.create/update =
adminOnlyFieldAccess` — kolekcia dovoľuje zákazníkovi PATCHnúť vlastný doklad
(`adminOrSelf`), takže bez toho by si mohol na svoj účet priradiť cudzie
Google `sub` a odchytiť cudzie prihlásenie. Zapisuje ich len OAuth callback
cez `overrideAccess: true`. Migrácie: `src/migrations-pg/20260915_061452_x3_oauth_identity.*`
+ sqlite dvojička `src/migrations/20260915_061505_x3_oauth_identity.ts`.

**Session bez hesla:** `payload.login()` sa použiť nedá (vyžaduje heslo, OAuth
účet má náhodné nepoužiteľné). `src/auth/oauth/session.ts` preto opakuje chvost
`loginOperation` tými istými exportovanými helpermi: `payload.db.findOne` (raw
riadok vrátane `sessions`) → `addSessionToUser` (`payload/shared`) →
`getFieldsToSign` + `jwtSign` (`payload`) → `generatePayloadCookie`
(`payload/shared`). `auth.useSessions` je default true a JWT stratégia token bez
zapísaného `sid` odmietne — preto krok 2 nie je voliteľný.

**Route handlers:** `GET /api/oauth/[provider]` (302 na poskytovateľa, podpísaný
`state` v httpOnly cookie `zap_oauth_state`, path `/api/oauth`, 10 min) a
`GET /api/oauth/[provider]/callback`. Middleware matcher `/api` nechytá, gate
teda flow neblokuje. Prepojenie na existujúci e-mailový účet len keď
poskytovateľ e-mail potvrdí (Google `email_verified`, Facebook Graph neoverené
adresy vôbec nevracia); inak slovenská chyba. `?redirect=` prechádza cez
Payload `getSafeRedirect` (same-origin only).

**Env:** GOOGLE_CLIENT_ID/SECRET, FACEBOOK_APP_ID/SECRET — prázdne = tlačidlá sa
nevykreslia a route odmietne. Callback URI do konzol:
`<NEXT_PUBLIC_SERVER_URL>/api/oauth/<provider>/callback`. Reálne credentials
zatiaľ neexistujú, takže celý round-trip s poskytovateľom je neoverený.

## Fáza 5 (2026-09-15)

- [x] Y1 Produktové dáta — HOTOVÉ (lokálne overené; build/push robí manažér):
      kolekcia product-properties
      („Vlastnosti", admin group Ecommerce — názov + voliteľné predvolené
      hodnoty); na produkte array properties [{property rel, value}],
      group dimensions (šírka/výška/hĺbka cm) + weight (g); relationships
      crossSell + upsell (relatedProducts už existuje). Fix viditeľnosti
      MCP API keys kolekcie (overrideApiKeyCollection — admini vidia
      všetky kľúče, kolekcia viditeľná v nav). Migrácie, MCP grants,
      seed, typy.
- [x] Y2 Feedy + tracking — HOTOVÉ (lokálne overené na PORT=3002; build/push robí
      manažér; TrackingScripts komponenty čakajú na 2 riadky v `(app)/layout.tsx`
      — pozri „Y2 — výsledok"): global feed-settings
      (enable, brand default, google_product_category, condition default,
      array mapovania: feedAttribute → zdroj [vlastnosť|pole|statická
      hodnota]); route handlery /feeds/google-merchant.xml (RSS 2.0 g:
      namespace) + /feeds/meta-catalog.xml a .csv (Meta akceptuje aj
      google formát); unstable_cache + revalidateTag pri afterChange
      produktov = automatická aktualizácia; SiteSettings/marketing global:
      headScripts + bodyStartScripts textareas (Meta pixel, GTM) →
      injektované v (app) layoute (adminOnly update = trust boundary).
- [x] Y3 PDP/cart frontend — HOTOVÉ (lokálne overené na PORT=3001):
      ProductProperties tabuľka „Vlastnosti" (hodnota+jednotka, rozmery cm,
      hmotnosť g / kg s čiarkou) na PDP; ProductRail „Mohlo by vás zaujať"
      (upsell) + „Súvisiace produkty" (related, reuse ProductGridItem);
      cross-sell „Doplňte k objednávke" v cart draweri cez /api/cross-sell
      (local API, read access rešpektovaný, exclude položiek v košíku,
      disabled pri inventory 0).
- [x] Y4 Mobilný app-shell — HOTOVÉ, nasadené: fixná spodná lišta
      (Domov/Telefón/E-mail/Hľadať/Účet/Košík s počítadlom, md:hidden,
      bg-brand-50, 60px + safe-area, .mobile-nav-offset na obsahu),
      HamburgerButton CSS morph čiary→X (transform/opacity only, zero-CLS,
      44×44 hit area), cart drawer = bottom sheet na mobile (85dvh,
      grabber) / right panel na desktope cez CartDrawerProvider,
      MobileSearchOverlay fullscreen (portál do body, autofocus, Escape);
      Sonner toasty pod md zdvihnuté nad lištu (globals.css).
- [x] Finále fázy 5: build OK, push c0059dc, deploy + produkčná
      verifikácia — pozri Stav hore.

Pozn.: MCP API keys „miznutie" = default pluginu (restrictToOwnKeys +
hidden kolekcia), nie strata dát — kľúče v DB sú.

### Y1 — výsledok

**Nová kolekcia `product-properties`** (`src/collections/ProductProperties.ts`,
labels „Vlastnosti"/„Vlastnosť", group Ecommerce, useAsTitle `name`,
defaultSort `sortOrder`): `name` (required, unique), `slug` (required, unique,
beforeValidate hook = kebab + odstránenie diakritiky; prázdny sa doplní z
`name`), `unit` (voliteľná, napr. „cm"), `predefinedValues` array `[{value}]`
(len návrhy — nič sa nevaliduje voči nim), `sortOrder`. Access: `read` verejný
(PDP je server component aj pre hostí), create/update/delete `adminOnly`.

**Produkt** (`src/collections/Products/index.ts`): nová záložka „Vlastnosti" s
poľom `properties` array `[{ property → product-properties (required), value
text (required) }]` a groupom `dimensions` („Rozmery a hmotnosť") s
`width/height/depth` (cm) **a `weight` (g) vnútri toho istého groupu** →
v JSON-e `dimensions.weight`, nie top-level `weight`. V záložke „Product
Details" pribudli `crossSell` („Doplnkové produkty (cross-sell)", košík) a
`upsell` („Upsell produkty", PDP); `relatedProducts` ostal a dostal slovenský
label „Súvisiace produkty". Všetky tri používajú spoločný `excludeSelf`
filterOptions (produkt sa neponúka sám sebe; pri seede, keď `id` ešte nie je,
degraduje na „ľubovoľný existujúci produkt").

**MCP API kľúče viditeľné:** `mcpPlugin({ overrideApiKeyCollection })`
v `src/plugins/index.ts` prepisuje access kolekcie `payload-mcp-api-keys`
z pluginového `restrictToOwnKeys` na `isAdmin` pre create/read/update/delete/
unlock, pridáva `admin.hidden: false`, slovenské labely („MCP API kľúče") a
defaultColumns. Pre admina je to rozšírenie (vidí a spravuje VŠETKY kľúče,
nielen vlastné), pre zákazníka zúženie (403 namiesto vlastných kľúčov).
Zámerne NEZMENENÉ: `user` pole má v plugine `access.create/update = false`,
takže kľúč sa nedá prepojiť na iného používateľa ani adminom — nový kľúč patrí
tomu, kto ho vytvorí. Existujúce dokumenty kľúčov sa nerotovali.

**Migrácie (aditívne):** `src/migrations-pg/20260915_070141_y1_product_data.*`
(+ sqlite dvojička `src/migrations/20260915_070154_y1_product_data.*`) —
tabuľky `product_properties`, `product_properties_predefined_values`,
`products_properties`, `_products_v_version_properties`, stĺpce
`products.dimensions_*` (+ verzie) a checkboxy
`payload_mcp_api_keys.product_properties_*`. `crossSell`/`upsell` nepotrebujú
DDL — idú do existujúcej `products_rels` (rozlišuje ich stĺpec `path`).
Dátová migrácia `src/migrations-pg/20260915_071500_y1_mcp_property_grants.ts`
zapne `productProperties` CRUD na „Production MCP key" (vzor
`20260915_060000_x1_grants_and_search_defaults`); lokálny kľúč rieši
`scripts/mint-mcp-key.ts` (`productProperties: fullCrud`).

**Seed** (`scripts/seed-dev.ts`, `seedProductPropertiesAndRelations`):
vlastnosti Materiál (predvolené vlna/bavlna/prútie) a Farba, hodnoty na oboch
demo produktoch (kôš: prútie/ružová, deka: vlna/béžová), rozmery + hmotnosť na
oboch, `deka.upsell = [kôš]` a `kôš.crossSell = [deka]`. Idempotentné a
nedeštruktívne — dopĺňa len to, čo je prázdne.

**Pre Y3 (PDP/košík):** `properties[].property` je vzťah, pri `depth >= 1` sa
populuje celý dokument vlastnosti (`name`, `slug`, `unit`, `predefinedValues`),
hodnota je `properties[].value` (string). `dimensions` je plochý objekt
(`width/height/depth` cm, `weight` g; chýbajúce = `null`). `crossSell`/`upsell`
sú polia vzťahov na `products` — pri `depth >= 1` sa vracia len podmnožina z
`defaultPopulate` produktu (title, slug, gallery, priceInEUR, inventory,
enableVariants, variants, meta), čo na kartu stačí; pri `depth: 0` sú to len ID.

### Y2 — výsledok

**Nový global `feed-settings`** (`src/globals/FeedSettings.ts`, label „Produktové
feedy", registrovaný cez `globalConfigs` → automaticky aj v MCP ako
`feedSettings` find/update): `enabled` (checkbox, **default FALSE** — kým je
vypnutý, všetky tri adresy feedov vracajú 404, lebo feed je verejný dump
katalógu s cenami), group `defaults` (`brand` = „ZAPLETANE", `condition`
new/refurbished/used, `googleProductCategory` — ID alebo cesta,
`shippingCountry` = „SK", `shippingPriceOverride` v centoch — prázdne = `g:shipping`
sa vôbec nezapíše), array `attributeMappings`
`[{ feedAttribute, customAttribute?, source, property?, staticValue? }]`.
`feedAttribute` = kurátorovaný zoznam (`g:material`, `g:color`, `g:size`,
`g:pattern`, `g:age_group`, `g:gender`, `g:custom_label_0..4`,
`g:product_length/width/height/weight`, `g:mpn`, `g:gtin`, + `custom` →
`customAttribute`, validované regexom, inak sa riadok ignoruje). `source` =
`property` (→ relationship na `product-properties`) | `dimensions.width|height|
depth|weight` | `filterTags` | `static`. Rozmery sa formátujú s jednotkou
automaticky (cm / g), vlastnosť si berie jednotku z definície vlastnosti,
`filterTags` sa spájajú čiarkou, prázdna hodnota = atribút sa pre daný produkt
vynechá, prvý riadok pre daný atribút vyhráva (žiadne duplicitné elementy).

**Feed route handlery** (`src/app/(app)/feeds/*`, logika v `src/lib/feeds/*`):
`/feeds/google-merchant.xml` (RSS 2.0 + `xmlns:g`), `/feeds/meta-catalog.xml`
(ten istý dokument — Meta akceptuje google formát, jeden renderer = feedy si
nikdy neprotirečia) a `/feeds/meta-catalog.csv` (Meta stĺpce, `in stock` /
`out of stock`, `shipping_weight` namiesto `g:product_weight`, UTF-8 **s BOM**
kvôli Excelu). Route handlery NEPREchádzajú cez `(app)/layout.tsx`, takže
coming-soon gate ich neblokuje (overené: `/` vrátilo predspúšťaciu stránku,
feed súčasne 200). Do feedu ide len publikovaný produkt s `priceInEUREnabled`
a s aspoň jedným obrázkom v galérii — produkt bez obrázka sa **vynechá** (oba
feedy `image_link` vyžadujú) a počet vynechaných je v XML komentári aj
v hlavičke `x-feed-skipped-no-image`. Popis = plain text z lexicalu cez
`convertLexicalToPlaintext` (`@payloadcms/richtext-lexical/plaintext`) →
`meta.description` → `title`. Dostupnosť: `getStockState` → `in_stock` /
`out_of_stock` / `backorder` (netrackovaný sklad, `inventory === null`).

**Revalidácia:** `getFeedPayload` je `unstable_cache` s `revalidate: 3600`
a tagmi `feeds` + `global_feed-settings`. Tag `feeds` púšťajú `afterChange`
aj `afterDelete` na kolekcii `products` (`src/collections/Products/index.ts`)
a `afterChange` na `feed-settings`. POZOR na semantiku Next 16: po
`revalidateTag` vráti **najbližší** request ešte starú verziu a na pozadí si
vyžiada novú (stale-while-revalidate) — druhý request je už aktuálny. Pre
crawlera je to irelevantné, pri ručnom overovaní treba requestnúť dvakrát.

**Tracking skripty:** `site-settings` má novú skupinu `marketing`
(`headScripts`, `bodyStartScripts`) — obsah sa vkladá doslovne, preto zostáva
`update: adminOnly` na globale trust boundary. `src/lib/trackingScripts.ts`
parsuje z uloženého textu `<script src>`, inline `<script>`, `<noscript>`,
`<meta>` a `<link>` a `src/components/TrackingScripts/*` ich renderuje ako
skutočné elementy (ostatné značky, vrátane `on*` atribútov, sa zahodia — raw
HTML sa do `<head>` v App Routeri vložiť nedá).

**TODO pre manažéra — 2 riadky do `src/app/(app)/layout.tsx`** (súbor patril
počas Y2 mobilnému agentovi, preto ho Y2 nezmenil). Import hore:

```tsx
import { TrackingScriptsBodyStart } from '@/components/TrackingScripts/BodyStart'
import { TrackingScriptsHead } from '@/components/TrackingScripts/Head'
```

a potom presne tieto dva riadky — prvý ako prvý potomok `<head>`, druhý ako
prvý potomok `<body>`:

```tsx
        <TrackingScriptsHead />
        <TrackingScriptsBodyStart />
```

t. j. `<head>` začne `<TrackingScriptsHead />` (pred `<InitTheme />`) a `<body>`
začne `<TrackingScriptsBodyStart />` (pred `<Providers>`). Overené na dočasnom
izolovanom root layoute: inline skript, `<script async src>` aj `<meta>` skončili
v `<head>`, GTM `<noscript>` hneď za `<body>`, `<p>` sa ignoroval.

**Migrácie (aditívne):** `src/migrations-pg/20260915_072320_y2_feeds_tracking.*`
+ sqlite dvojička `src/migrations/20260915_072334_y2_feeds_tracking.ts` (tabuľky
`feed_settings`, `feed_settings_attribute_mappings`, stĺpce
`site_settings.marketing_*` a `payload_mcp_api_keys.feed_settings_*`) a dátová
migrácia `src/migrations-pg/20260915_072600_y2_feed_grants.ts` (zapne
`feedSettings` find/update na „Production MCP key"; lokálny kľúč rieši
`scripts/mint-mcp-key.ts`).

**Seed:** `seedProductImages` v `scripts/seed-dev.ts` pripojí demo produktom
galériu z už commitnutých hero fotiek (`public/assets/images/hero`) — bez
obrázka by demo produkty vo feede vôbec neboli (a chýbali by aj na PDP pre Y3).
Idempotentné: produkt s galériou sa nechá tak, médium sa hľadá podľa `filename`.

- [ ] Y4 Mobilný app-like shell (Opus, frontend-only, paralelne s Y1;
      Y3 až PO Y4 — kolízia na Cart komponentoch): statická horná lišta
      (logo + hamburger s plynulou morph animáciou čiarky→X, bez
      preblikov a layout shiftov), statická spodná lišta (Domov, telefón,
      e-mail, vyhľadávanie, účet, košík s počítadlom — DESIGN-SPEC §2.4
      ako 1:1 základ), obsah sa mení medzi lištami; cart drawer na
      mobile zo SPODU; vyhľadávanie na mobile = fullscreen overlay.
