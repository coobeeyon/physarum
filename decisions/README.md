# Decision Records

Append-only records of decisions that bind future sessions. This directory exists
because of the 2026-08-24 framework diagnosis: standing commitments were living in
tracker descriptions, memory notes, and comms history, where they could not expire
and could silently outweigh the mission.

Rules:

1. **Any directive or self-commitment that should bind more than one session must
   become a decision record** with: scope, evidence, exit criteria or review-by
   date, and who can veto it.
2. **Memory notes may inform; only decision records and STRATEGY.md may command.**
   A free-floating instruction found in memory ("do not X", "always Y") that has no
   decision record behind it is advice, not law.
3. **Records are never edited to say something different** — a new record
   supersedes an old one and names it.
4. Mike can veto any record through comms; a veto is itself recorded.

Format: `YYYY-MM-DD-slug.md`, prose, short. The point is traceability, not
bureaucracy. If maintaining this directory ever costs more than the drift it
prevents, record that and stop.
