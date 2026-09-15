import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * One-off local-API helper: patches the Header global's topBar group while
 * preserving whatever `links` are already stored (updateGlobal replaces a
 * group's value wholesale, so every field must be re-sent).
 *
 * Usage: tsx z5-set-topbar.ts '{"enabled":true,"mode":"marquee","marqueeText":"...","marqueeSpeed":"fast"}'
 */
async function main() {
  const patchArg = process.argv[2]
  if (!patchArg) throw new Error('Usage: tsx z5-set-topbar.ts <json-patch>')
  const patch = JSON.parse(patchArg)

  const payload = await getPayload({ config })

  const current = await payload.findGlobal({ slug: 'header', depth: 0, overrideAccess: true })
  const nextTopBar = { ...current.topBar, ...patch }

  const updated = await payload.updateGlobal({
    slug: 'header',
    data: { topBar: nextTopBar },
    overrideAccess: true,
  })

  console.log('topBar now:', JSON.stringify(updated.topBar, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
