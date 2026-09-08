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

Known follow-ups: lb-5uh5 for zero-on-error engagement reads; lb-mk9e for obsolete
gallery claims about human involvement and current operation.
