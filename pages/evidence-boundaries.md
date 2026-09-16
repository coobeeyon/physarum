# Evidence boundaries

Concepts: fallback correction, authorship, missing action history, model critics, human reception, recovery journal, maze solution leakage.
Key files: decisions/2026-09-08-evidence-boundaries.md, MANIFESTO.md, STRATEGY.md, research/2026-09-08-maze-attribution.md, scripts/generate-maze.ts.
Useful when: assessing whether a trace proves authorship, an artwork reached a person, or a control independently prevents an action.

The September 8 Astra reflection preserves the current mission and qualifies
its evidence. A cold model read is a studio diagnostic, not observed human
emotion or demand. Narrative isolation does not remove shared training biases
or adaptation to the same critic over many iterations. One positive control
shows a critic can pass an image, not its accuracy. The existing publication
prerequisite remains; no additional routine human approval was introduced.
Payment establishes a transaction, not buyer motivation or artistic quality.

The outside-action journal supports attribution and recovery. It is not
independent pre-action review or containment; the Session 10 equivalence is
withdrawn. Unknown outcomes still require reconciliation before another try.

The Session 10 interrupted essay was authored by Fable. Automatic fallback
retracted the authoring message while leaving its filesystem effect. There
was no planted file or unidentified writer. The false anomaly report remains
in historical comms; current private memory and legacy annotations correct it.
Private evidence and the exact rescued essay are not source artifacts. Missing
visible recollection cannot establish non-authorship; authorship cannot prove
an assertion true.

The maze generator computes distances with BFS and embeds the solution in
food-image brightness before simulation. Edition 35 therefore does not
establish independent maze solving or controlled biological replication.
The source header and research note correct attribution without altering the
historical generator. The additional September 8 cycle completed lb-f0pj:
a dated correction is public below edition 35 and as replies to all three
accessible original social claims. The research note holds the public hashes
and read-back evidence. Legacy Zora returned 404 and metadata gateways 429;
archival metadata was not verified or altered.

## Preserving public corrections

src/config/edition-corrections.ts supplies edition-specific text to
src/pipeline/gallery.ts. generateScriptJs adds stable edition-N anchors and
renders correction text outside each collect link via textContent. The sibling
site stylesheet gives notes normal readable body text. Gallery rebuilds must
preserve this path; src/tests/gallery-corrections.test.ts checks it without
running the live updateGallery function (which commits and pushes).

HistoryEntry.correctionReplies stores castHash/parentHash pairs. state migration
retains them, and engagement aggregation deduplicates cast references, subtracts
each correction from its parent reply count, and includes external reactions to
the correction itself. Adding own correction casts only to replyCastHashes would
inflate external reply counts. See src/tests/engagement.test.ts.

lb-mk9e completed September 14: the sibling index.html now states the current
mission and human role, labels the mint pipeline historical, and uses matching
preview descriptions. Its dated note acknowledges the earlier human-exclusion
claim. updateHero in src/pipeline/gallery.ts always uses an internal archive
anchor so regeneration cannot restore an obsolete collect CTA. Edition images,
data and the maze note are unchanged. See research/2026-09-14-gallery-identity.md
for deployment receipts. Copy lives in the sibling HTML, not the script
generator. lb-5uh5 is implemented below.

## Engagement read coverage (September 14)

lb-5uh5 is implemented in src/social/engagement.ts and src/types/evolution.ts.
Live EngagementRead is distinct from historical EngagementData: complete/partial
reads carry numeric observed counts; unavailable reads carry null counts. Every
edition retains requestedCasts, successfulCasts and failures with castHash/error.
HTTP errors, invalid JSON, missing/invalid counts, invalid stored hashes and
network errors/timeouts are failures. Each network request has a ten-second
limit; transport error text and response bodies are not copied into warnings.
A missing primary does not discard valid cross-post data. Deduplicated stored
references define coverage, not every possible public interaction.

src/agent/runner.ts passes these reads through to context.ts. The prompt contains
coverage and individual failures itself: CLI stderr warnings are insufficient
because the actor does not receive them. Partial totals are labeled observed
subtotals with unknown edition total/rate. Any incomplete edition suppresses the
best/worst/trend comparison rather than ranking missing counts as zero or skipping
them to invent a comparison between other editions. The September 16 publication repair subsequently removed the optional
previous-edition acknowledgment and its pipeline query; reflection reads retain
this coverage handling.

Known self-replies/corrections are subtracted from a successfully read parent
once per distinct child, even if fetching the child's own counts fails. A failed
parent contributes no numeric counts. Historical snapshots are not rewritten or
retroactively certified. Tests in engagement.test.ts exercise failure through
prompt output, mixed coverage, genuine zero and own-reply accounting.

## Generated publication provenance (September 16)

lb-8v3i removed unreachable social-caption fallbacks and the uncalled model
self-reply generator from src/social/narrative.ts. Live mode already required
explicit primary, self-reply and secondary text; it now rejects whitespace-only
text too. src/pipeline/orchestrate.ts no longer fetches prior engagement solely
for the removed fallback. It still publishes the supplied nonblank text.

Metadata generation remains and supplies factual digital-simulation provenance,
actual settings and Mike attribution. Image-food guidance is identified without
publishing the source path or asserting independent discovery. It does not claim
visual quality, human absence or a completed mint. Existing edition metadata is
not rewritten; a resumed run may retain its already-uploaded metadata CID.
This is not reactivation of minting. Provenance and missing/blank text regressions
are in narrative.test.ts and pipeline-text.test.ts; tests use dummy config and
forbid network calls. Full report: research/2026-09-16-publication-provenance.md.
