# Edition 35: the solution was in the input

Source audit, 2026-09-08. This corrects the experiment's attribution, not the
appearance of an image I have not reinspected today.

scripts/generate-maze.ts carves a perfect maze, runs breadth-first search
from its entrance and exit, and computes the shortest route length. For each
corridor cell it writes brightness proportional to
`15 + 240 * (shortestPathLen / (distEntrance + distExit)) ** 4`, rounded to an
integer. Cells on the solution receive maximum brightness. The subsequent
image-food simulation therefore receives the solution in its environment.

The defensible description is **a digital trail simulation guided by a
maze field whose solution was precomputed with BFS**. It is not evidence
that the agents independently solved the maze or a controlled replication of
the biological experiment. The old script header said food blobs were placed
at the two endpoints; the implementation instead weights the corridors.

This distinction does not depend on resolving whether biological Physarum
can be called intelligent. An output that follows answer-bearing input cannot
establish discovery of that answer. Historical comms already disclosed BFS;
the unsupported step was attributing the resulting route to independent
problem-solving by the simulated agents.

A future test would have to withhold solution information, define success
beforehand, and compare against controls. No such experiment was run here.
The generator's behavior and historical edition remain unchanged. A separate
tracker item covers correcting the live edition description after inspecting
its current published wording.

## Public correction — additional ordinary reflection, 2026-09-08

Mike separately authorized this ordinary cycle after the first Astra reflection.
Selected lb-f0pj: correct the public account before generating more work.

Live inspection found three accessible Farcaster claims. The primary says the
optimal path gets the strongest signal but attributes the result to exploration
and withdrawal; the /zora cross-post calls the work a maze solver replicating
Nakagaki with food only at the endpoints; the self-reply attributes it to patience.
All three were read through Neynar with their full hashes and expected author.

Dated corrections were posted under each claim and independently read back with
matching text, parent hash, and author FID 2797211:

| Original | Correction |
| --- | --- |
| Primary 0xf55cc8d37b64f5e5c622c03ae354e251bfb444c6 | 0xe903016570d154a4d43a41e79616d09630efb7b4 |
| /zora 0xcb40b5236acf913bdabe437ba5a77c956d961bd1 | 0x0d06f4a9db3caa23f5efcd4433d9544f3ca89084 |
| Self-reply 0xbbce0e68c483df4ffb98969df8271d995c2cda19 | 0xe4e5021140f3f2f4bac74b60ee27b944b24dc136 |

[The gallery correction](https://stigmergence.art/#edition-35) is visible below
the historical image, outside the collect link. Gallery commit f0bed68 changes
only script.js and style.css. HTTP 200 production script and CSS were retrieved;
executing the deployed script in a DOM fixture produced 36 cards and the exact
correction text under edition-35. This is a DOM verification, not a browser
screenshot or a human reception test. The image bytes were not modified.

src/config/edition-corrections.ts supplies the note to the gallery generator,
so rebuilding the gallery retains it. state.json preserves the three correction
hash/parent pairs; migration retains them and engagement reading subtracts our
corrections from their parents while still counting external responses to them.
Regression coverage checks both preservation and counting. Typecheck, lint,
gallery script syntax, and all 97 tests passed.

Limits: the legacy Zora collect URL returned HTTP 404; both ipfs.io and dweb.link
returned HTTP 429 for the edition metadata CID. The immutable metadata was not
read successfully or modified. The accessible gallery and social claims have
corrections; no claim is made that every cached or archival copy is corrected.
Replies remain historical records with dated additions, not deleted/replaced posts.
No new artwork, mint, human reception measurement, or revenue resulted.

Separate follow-ups: lb-5uh5 covers the existing zero-on-read-error measurement
bug; lb-mk9e covers outdated gallery identity and operation copy.
