import type { Post, Product } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { checkRole } from '@/access/utilities'
import { sectionsToLexical } from '@/ai/articleLexical'
import { formatImagePrompts, generateArticle, MAX_PRODUCTS_IN_CONTEXT } from '@/ai/articleWriter'

/**
 * POST /api/posts/generate — napíše článok do rozpísaného konceptu (Z15).
 *
 * Telo: `{ postId: number|string, prompt: string }`.
 *
 * Priebeh: kontext z publikovaných produktov → model → lexical strom →
 * `payload.update` s `draft: true`. **Nikdy sa nepublikuje.** Článok skončí
 * ako koncept, majiteľka si ho prečíta, upraví a publikuje sama — to je celý
 * zmysel toho, že tu nie je žiadna automatika navyše.
 *
 * V tom istom volaní vznikajú aj **návrhy obrázkov** (Z19) — do poľa
 * `aiImagePrompts`. Každý návrh menuje jeden skutočný produkt z katalógu,
 * lebo majiteľka k promptu priloží jeho fotku ako referenciu. Sú to len
 * poznámky v bočnom paneli: keď sa nevygenerujú, článok sa uloží aj tak.
 *
 * `slug` sa zámerne nenastavuje. Postará sa oň továreň `slugField()`: pri
 * zmene názvu (a toto uloženie nie je autosave) sa adresa prepočíta z nového
 * názvu a na starú vznikne presmerovanie. Ručne zapísaný slug by tento
 * mechanizmus obišiel a pri zamknutej adrese („URL upravujem ručne") by ju
 * dokonca prepísal proti vôli majiteľky.
 *
 * `maxDuration` je 180 s: písanie trvá 60–120 s (600–900 slov po slovensky je
 * ~5 tokenov na slovo a od Z19 k nim pribudnú ešte prompty na obrázky) a model
 * má vlastný strop 150 s, takže na zápis konceptu ostáva rezerva. Pred Z19 to
 * bolo 120/100 s — na článok so štyrmi návrhmi obrázkov to už nestačilo.
 * Scraper v tomto repozitári beží s `maxDuration = 300`, takže 180 s je pre
 * túto tarifu overená hodnota.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 180

type GenerateBody = {
  postId?: unknown
  prompt?: unknown
}

const json = (body: unknown, status = 200): Response => Response.json(body, { status })

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config: configPromise })

  const { user } = await payload.auth({ headers: request.headers })

  if (!checkRole(['admin'], user)) {
    return json({ message: 'Na generovanie článkov potrebuješ práva správcu.', ok: false }, 403)
  }

  let body: GenerateBody

  try {
    body = (await request.json()) as GenerateBody
  } catch {
    return json({ message: 'Nečitateľná požiadavka.', ok: false }, 400)
  }

  const postId = typeof body.postId === 'number' || typeof body.postId === 'string' ? body.postId : null
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''

  if (!postId) {
    return json({ message: 'Najprv ulož koncept článku — bez neho nie je kam písať.', ok: false }, 400)
  }

  if (prompt.length < 5) {
    return json({ message: 'Zadaj tému alebo pokyny pre článok.', ok: false }, 400)
  }

  // Existuje vôbec? Lepšia hláška teraz než zlyhaný zápis po minúte písania.
  const existing = await payload.findByID({
    id: postId,
    collection: 'posts',
    depth: 0,
    draft: true,
    overrideAccess: false,
    user,
  }).catch(() => null)

  if (!existing) {
    return json({ message: 'Článok sa nenašiel. Ulož koncept a skús to znova.', ok: false }, 404)
  }

  /**
   * Kontext pre model: čo e-shop naozaj predáva. Len publikované, len názov a
   * adresa, maximálne `MAX_PRODUCTS_IN_CONTEXT` — model má z čoho vyberať
   * a pritom nedostane do kontextu celý katalóg (drahé a zbytočné).
   *
   * Od Z19 stojí na tomto zozname aj druhá vec: prompty na obrázky. Obrázok sa
   * generuje s priloženou fotkou skutočného produktu, takže model smie
   * pomenovať len to, čo tu naozaj je. Keď sa načítanie nepodarí alebo je
   * katalóg prázdny, návrhy obrázkov jednoducho nevzniknú — článok áno.
   */
  let products: { slug: string; title: string }[] = []

  try {
    const found = await payload.find({
      collection: 'products',
      depth: 0,
      // Publikovaná verzia, nie rozpísaný koncept: fotka musí byť na webe.
      draft: false,
      // `pagination` sa nevypína — inak by sa `limit` ignoroval a do kontextu
      // by spadol celý katalóg.
      limit: MAX_PRODUCTS_IN_CONTEXT,
      overrideAccess: false,
      select: { slug: true, title: true },
      sort: '-updatedAt',
      user,
      where: { _status: { equals: 'published' } },
    })

    products = found.docs
      .map((doc) => doc as Pick<Product, 'slug' | 'title'>)
      .filter((doc) => Boolean(doc?.title))
      .map((doc) => ({ slug: doc.slug ?? '', title: doc.title }))
  } catch (err) {
    // Bez produktov sa článok napísať dá — len v ňom nebude čo spomenúť.
    payload.logger.warn({ err }, '[posts/generate] produkty sa nepodarilo načítať')
  }

  const started = Date.now()
  const result = await generateArticle({ products, prompt })
  const elapsedMs = Date.now() - started

  if (!result.ok) {
    payload.logger.warn(
      { elapsedMs, postId },
      `[posts/generate] generovanie zlyhalo: ${result.error}`,
    )

    return json({ message: result.error, ok: false }, 502)
  }

  const { article, usage } = result
  const content = sectionsToLexical(article.sections)

  if (!content) {
    return json({ message: 'AI vrátila prázdny text. Skús to znova.', ok: false }, 502)
  }

  // Meta skupina zo SEO pluginu sa dopĺňa, neprepisuje — obrázok musí prežiť.
  const meta = (existing as Post).meta ?? {}

  /**
   * Návrhy obrázkov sa zapisujú vždy, aj keď sú prázdne.
   *
   * Prompty patria ku konkrétnemu textu (citujú jeho podnadpisy), takže keď si
   * majiteľka nechá napísať novú verziu článku, staré návrhy už neplatia.
   * Nechať ich v poli by znamenalo prompty na sekcie, ktoré v článku nie sú.
   */
  const imagePrompts = formatImagePrompts(article.imagePrompts)

  try {
    await payload.update({
      id: postId,
      collection: 'posts',
      // Koncept, nikdy nie publikovanie — hotový text si majiteľka pustí von sama.
      draft: true,
      data: {
        aiImagePrompts: imagePrompts,
        aiPrompt: prompt,
        // Lexical stav z `@payloadcms/richtext-lexical` je štruktúrne rovnaký
        // ako generovaný typ poľa, len bez indexovej signatúry.
        content: content as Post['content'],
        excerpt: article.excerpt,
        meta: {
          ...meta,
          description: article.metaDescription,
          title: article.metaTitle,
        },
        title: article.title,
      },
      overrideAccess: false,
      user,
    })
  } catch (err) {
    payload.logger.error({ err, postId }, '[posts/generate] koncept sa nepodarilo uložiť')

    return json({ message: 'Článok sa napísal, ale nepodarilo sa ho uložiť.', ok: false }, 500)
  }

  payload.logger.info(
    { elapsedMs, imagePrompts: article.imagePrompts.length, postId, usage, words: article.wordCount },
    `[posts/generate] hotovo: „${article.title}"`,
  )

  return json({
    elapsedMs,
    // Koľko návrhov obrázkov pribudlo — tlačidlo to povie v hláške.
    imagePrompts: article.imagePrompts.length,
    ok: true,
    title: article.title,
    wordCount: article.wordCount,
  })
}
