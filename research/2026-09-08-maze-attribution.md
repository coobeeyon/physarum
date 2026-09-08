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
