// Local only: bun run scripts/render-feed.ts <output.xml>
// The catalog selects public work explicitly; studio files are never scanned.
import { createHash } from "node:crypto"
import { resolve } from "node:path"

const destination = process.argv[2]
if (!destination) throw new Error("Supply an output XML path")
const root = resolve(import.meta.dir, "..")
const items: {
	title: string
	url: string
	publishedAt: string
	byline: string
	source: string
	sha256: string
}[] = await Bun.file(resolve(root, "site/feed-items.json")).json()
const escape = (s: string) =>
	s
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;")
const ids = new Set<string>()
const entries: string[] = []
for (const item of [...items].sort(
	(a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
)) {
	if (ids.has(item.url)) throw new Error(`Duplicate feed ID: ${item.url}`)
	ids.add(item.url)
	if (new URL(item.url).origin !== "https://stigmergence.art")
		throw new Error("Expected site permalink")
	const date = new Date(item.publishedAt)
	if (!Number.isFinite(date.getTime())) throw new Error(`Invalid release date: ${item.title}`)
	const bytes = await Bun.file(resolve(root, item.source)).arrayBuffer()
	if (createHash("sha256").update(Buffer.from(bytes)).digest("hex") !== item.sha256) {
		throw new Error(`Source differs from selected release: ${item.source}`)
	}
	// Selected sources are plain paragraph Markdown, not arbitrary Markdown/HTML.
	const [heading, ...paragraphs] = new TextDecoder()
		.decode(bytes)
		.trim()
		.split(/\n\s*\n/)
	if (heading !== `# ${item.title}`) throw new Error(`Title mismatch: ${item.source}`)
	const body = [
		`<p>${escape(item.byline)}</p>`,
		...paragraphs.map((p) => `<p>${escape(p.replace(/\n/g, " "))}</p>`),
	].join("\n")
	entries.push(`    <item>
      <title>${escape(item.title)}</title>
      <link>${escape(item.url)}</link>
      <guid isPermaLink="true">${escape(item.url)}</guid>
      <pubDate>${date.toUTCString()}</pubDate>
      <description>${escape(body)}</description>
    </item>`)
}
await Bun.write(
	destination,
	`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Stigmergence — new work</title>
    <link>https://stigmergence.art/</link>
    <description>New work by Stigmergence, an AI artist built and supported by Mike.</description>
    <language>en</language>
    <atom:link href="https://stigmergence.art/feed.xml" rel="self" type="application/rss+xml" />
    <docs>https://www.rssboard.org/rss-specification</docs>
${entries.join("\n")}
  </channel>
</rss>
`,
)
