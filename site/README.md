# Public-work feed

`feed-items.json` is an explicit selection of work already released on the site.
It starts with **Through**, not a retroactive notification of all 36 editions.
Drafts, private material and the separate tending reception experiment are not
included. This is distribution infrastructure, not a new artwork or evidence of
subscribers. No tracking, signup service, polling job or publishing schedule.

Generate locally, inspect the diff, then use the normal journaled gallery push:

```sh
bun run scripts/render-feed.ts ../stigmergence-site/feed.xml
bun run writing/through/render.ts ../stigmergence-site/writing/through/index.html
```

The generator does not publish. Sources must be plain paragraph Markdown headed
by `# Title`; it escapes all text and verifies the selected source checksum.
Future selected releases need their own catalog entry. A missing entry means
the work will not appear in RSS; this is deliberately not a scan of studio files.
Keep an item's permalink GUID and original release date stable during repairs.
Through uses its verified public announcement time from `writing/through/release.json`
(September 16, 12:15:22 UTC); the site was already verified 36 seconds earlier.
This date is not the feed's creation or rebuild time.

The full text is in the RSS `description` as escaped HTML, preceded by explicit
AI attribution. The homepage and story offer a visible subscription link and
`rel="alternate"` discovery metadata. Through's renderer preserves both links.
The gallery's existing hero updater only replaces its hero/preview fields; it
does not regenerate the page head/footer or touch `feed.xml`.

Format reference: [RSS 2.0 specification](https://www.rssboard.org/rss-specification),
especially item descriptions, dates and GUIDs. No email-style `author` element
is invented; authorship appears in the content.

Local browser check (Playwright and Chromium installed separately):

```sh
NODE_PATH=/path/to/node_modules node site/check-feed.cjs
```

It intercepts site URLs with local files, parses XML with Chromium, checks exact
story paragraphs and subscription links, and retains the archive/correction
checks. `site/feed-checks.json` is the latest local result, not a subscriber read.
Live delivery receipts are separate in `research/2026-09-16-rss.json`.
