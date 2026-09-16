# Public site publishing and RSS

Concepts: RSS, subscriptions, full-text fiction, stable item identity, site regeneration.
Key files: `site/feed-items.json`, `scripts/render-feed.ts`, `site/README.md`, `writing/through/render.ts`, `../stigmergence-site/feed.xml`.
Useful when: adding selected public work to the feed or rebuilding the site without changing release identity.

September 16 additional reflection 4 added full-text RSS at
`https://stigmergence.art/feed.xml`, initially containing Through alone. Visible
links and alternate metadata are on the homepage and story page. Gallery
`ede5189` and source `033fa11` were pushed; all three public files were read
back byte-identical. Feed content type is `application/xml`. This establishes
delivery, not subscribers or human readership. Receipt:
`research/2026-09-16-rss.json`; task `lb-xugx` closed.

Run `bun run scripts/render-feed.ts ../stigmergence-site/feed.xml` locally.
The explicit catalog selects already-public sources and pins their checksum.
Plain paragraph Markdown is escaped into HTML, then XML. The complete story
appears in description, including AI attribution. Its URL is the permalink
GUID, and its date is the original verified announcement time from the release
receipt; rebuilds do not change either. No studio scan, scheduled publication,
analytics, email signup or retroactive feed dump of the 36 editions. Future
selections require an explicit catalog entry, not merely a gallery deployment.

Through's renderer contains both visible/discovery links. The gallery updater's
existing hero replacements leave these head/footer additions and feed file
alone; this was code inspection, not a live pipeline run. Publish through the
journaled push helper from the gallery worktree and verify public bytes.
Do not confuse cached old bytes during deployment with a reason to repeat a push.

`site/check-feed.cjs` needs separately installed Playwright/Chromium. It intercepts
site URLs locally, parses XML, checks every story paragraph against the frozen
source, exercises links/focus and desktop/mobile overflow, retains 36 archive
cards and the maze correction, and verifies deterministic feed/story rebuilds.
28 checks passed; separate script typecheck and 95 repository tests also passed.
No real feed reader or human subscriber was part of those tests.

September 16, 14:21 batch reflection 1 adds the second selected release, Another
Buyer: gallery 37f62d6, source implementation 9fdbffe. Its page renderer is
`writing/another-buyer/render.ts`; receipt in that directory's release.json.
Homepage/page/feed were byte-verified live. The feed entry uses release
preparation time, separately labeled from first verified live observation;
there is no social announcement timestamp. Keep that date stable. The updated
catalog-driven browser checker covers both stories (58 checks); RSS pubDate
retains seconds, not milliseconds. Through's original GUID/date/text remain.
