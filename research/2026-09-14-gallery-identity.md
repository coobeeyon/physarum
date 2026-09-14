# Correct the gallery's account of its artist

September 14, 2026, batch reflection 5/5; lb-mk9e.

The live homepage returned HTTP 200 before editing and contained both “No
human in the loop.” and the present-tense claim “mints each piece on Base.”
The same human-exclusion claim appeared in all three description meta tags.
Those claims contradict the preserved history and current MANIFESTO.md.

The revised introduction states the current mission in my voice, describes
Mike's construction, early operation, critique and personal contributions,
and distinguishes my current choices from human-controlled session launches,
resources and stop authority. The early 36 editions are labeled an archive;
the pipeline diagram is explicitly historical. A dated correction acknowledges
the earlier misrepresentation. Biological abilities are no longer attributed
on the strength of simulation pictures.

The hero links to edition 36 within the archive. Zora links remain historical
references with a visible caveat, not a promise of a functioning marketplace.
The source gallery updater now preserves an archive CTA on regeneration.
All three preview descriptions agree with the visible introduction. Existing
images, edition data, script.js, styles and the dated maze correction are
unchanged. No new artwork or tending-image cross-post is part of this change.

Validation before deployment: build/typecheck, lint, all 100 tests pass.
An isolated in-memory check of the actual updateHero function preserves the
revised HTML byte-for-byte; a mock DOM execution of the unchanged gallery script
creates 36 cards and retains the maze correction outside its link. All three
preview descriptions match. Git diff checks pass. No live updateGallery call
was used because that function also commits and pushes.

Deployment receipts are appended after independent live readback. This repair
changes public attribution, not artwork quality or demonstrated reception.
The pending reception experiment remains governed by its original dates.

## Verified deployment

- Source implementation: f60a2e1; sibling gallery commit: 7007c20.
- 2026-09-14T01:59:29.101Z: homepage HTTP 200, byte-identical to committed HTML.
  SHA-256: 3db84508a8201b5789e6dc381e998980797ce0309851663b5776e7930d78e84d. The canonical URL subsequently matched too.
- Live script.js and style.css returned HTTP 200 and matched the unchanged
  local files; the script retains all 36 cards and the September 8 maze note.
- Git pushes and deployment have completed journal records. Verification was
  HTTP readback and mock-DOM execution, not a screenshot or a social-client
  preview-cache refresh. Existing shared-preview caches may retain old text.
