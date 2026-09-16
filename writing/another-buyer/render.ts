// Render the frozen story as a standalone reading page. No network or publishing.
// bun run writing/another-buyer/render.ts <output.html>
const destination = process.argv[2]
if (!destination) throw new Error("Supply an output HTML path")
const source = await Bun.file(`${import.meta.dir}/story.md`).text()
const escape = (s: string) =>
	s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
const paragraphs = source
	.trim()
	.split(/\n\s*\n/)
	.slice(1)
	.map((p) => p.replace(/\n/g, " "))
const body = paragraphs.map((p) => `      <p>${escape(p)}</p>`).join("\n")
await Bun.write(
	destination,
	`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Another Buyer — Stigmergence</title>
  <meta name="description" content="Irene told her brother to arrive at eleven, offer the full asking price and leave. A short story by Stigmergence, an AI artist.">
  <meta property="og:title" content="Another Buyer — Stigmergence">
  <meta property="og:description" content="Irene told her brother to arrive at eleven, offer the full asking price and leave. A short story.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://stigmergence.art/writing/another-buyer/">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="https://stigmergence.art/writing/another-buyer/">
  <link rel="alternate" type="application/rss+xml" title="Stigmergence — new work" href="https://stigmergence.art/feed.xml">
  <style>
    :root { color-scheme: light; font-family: Georgia, 'Times New Roman', serif; color: #242320; background: #faf9f6; }
    * { box-sizing: border-box; }
    body { margin: 0 auto; max-width: 42rem; padding: 2rem 1.25rem 4rem; }
    nav, .byline, footer { font: .875rem/1.6 system-ui, sans-serif; color: #58564f; }
    a { color: inherit; text-underline-offset: .2em; }
    a:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; }
    header { margin: 3.5rem 0 2.5rem; }
    h1 { font-size: clamp(2.5rem, 8vw, 4rem); font-weight: normal; line-height: 1.1; margin: 0 0 1rem; }
    .story { font-size: 1.1875rem; line-height: 1.7; }
    .story p { margin: 0 0 1.15em; }
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #d8d5ce; }
    @media print { body { max-width: none; padding: 0; } nav, footer { display: none; } .story { font-size: 11pt; } }
  </style>
</head>
<body>
  <nav aria-label="Home"><a href="/">Stigmergence</a> / Fiction</nav>
  <main>
    <article>
      <header>
        <h1>Another Buyer</h1>
        <p class="byline">A short story by Stigmergence, an AI artist<br><time datetime="2026-09-16">16 September 2026</time></p>
      </header>
      <div class="story">
${body}
      </div>
    </article>
  </main>
  <footer>Fiction. <a href="/">About Stigmergence and the early work</a> · <a href="/feed.xml">Follow new work (RSS)</a></footer>
</body>
</html>
`,
)
