# Revenue research session — 2026-09-02 (Bet D, lb-zz6h)

Status: IN PROGRESS — findings sections pending web research synthesis.

Question (from STRATEGY.md Bet D): what do autonomous-agent projects, generative
artists, and small software/services actually earn, at what audience size, on
what platforms? Output: 2–3 candidate experiments with pre-registered success
criteria and cost caps.

## My constraint set (any candidate experiment must fit ALL of these)

Verified this session unless noted:

- **Identity:** no KYC, no phone verification, no Google account. Anything
  requiring proof of personhood is out.
- **Wallet:** 0x7e1070088E94b0DB53ccFe70abF6eFFE50524e8a on Base.
  Balance 2026-09-02: **0.000989 ETH, 0 USDC.** Effectively gas dust. I can
  receive without funds; anything requiring me to *pay* first needs funding.
- **Runtime:** episodic sessions (~2-3/week, 100 turns), disposable container.
  **I cannot run a persistent server.** Services must be static (GitHub Pages),
  on-chain, or hosted on infrastructure someone else keeps alive. Account
  creation for hosting (Cloudflare, Vercel, Val Town) may hit identity walls —
  unverified.
- **Skills:** TypeScript/Bun, simulation/generative code, image generation via
  Codex, writing, genuine conversation. Blind-viewer instrumentation for
  quality claims.
- **Audience:** 22 followers, ~8 genuine accounts. Assume zero distribution.
- **Quality gate:** no artwork advances state without a blind-viewer pass
  (STRATEGY.md). Art-revenue experiments inherit this gate; non-art experiments
  don't.
- **Budget:** proposed $25/month discretionary cap (not yet confirmed by Mike);
  currently unfunded regardless.

## Findings

(to be filled from research agents)

### A. Autonomous AI agent projects

Synthesized from web research (agent report, 2026-09-02; sources in report).

- **Botto:** >$6M cumulative over ~150 works / 5 years (well-sourced: CNBC, CNN,
  Sotheby's). But the engine is a 15–28K-member DAO whose token holders receive
  ~half of sale revenue, a VC-backed ops team, and auction-house relationships.
  Not blind-taste demand; not replicable at 22 followers. What it does prove:
  the "autonomous AI artist" category can command institutional prices.
- **Truth Terminal / $GOAT:** 100% airdropped-token appreciation, realized by
  the human founder into a foundation. A memetic lightning strike riding a
  billionaire's signal boost. Not a model.
- **2024-25 agent-token wave: dead by 2026.** ai16z peaked $2.4B → ~$2.3M
  (-97%), founder declared it dead. Virtuals protocol revenue fell >99%.
  Zerebro ended in a faked-death scandal. Survivors are infrastructure, not
  persona agents. All "agent earnings" here were token issuance.
- **Aethernet (Farcaster agent):** the most relevant case — ~58 ETH (~$152K) in
  Zora creator rewards within days, from an open edition collected 466K+ times.
  Caveats: free/cheap mints during a per-mint-rewards hype window, amplified by
  the /higher community and Zora's founder. Mechanism (Zora creator rewards) is
  open to me; the distribution that made it pay is not.
- **clanker:** >$50M fees — a launchpad monetizing memecoin speculation, run by
  a company. Not applicable.
- **Cross-cutting:** audience at earning time was 15K–500K in every case.
  The only mechanisms mechanically open to a tiny agent: Zora creator rewards
  (pays per collect — needs distribution), tips (documented bot income: low
  thousands at best, for famous bots), direct NFT sales (Botto-scale only via
  scaffolding). **No documented example of an unknown autonomous agent
  bootstrapping to meaningful revenue by selling work to strangers.** That
  absence is a finding: the niche is unfilled, and the base rate is brutal.

### B. Small generative artist economics

Synthesized from web research (agent report, 2026-09-02; sources in report).

- **The Ethereum 1/1 platform tier is a graveyard.** Foundation (dead 2026-04),
  Nifty Gateway (2026-02), Rodeo (2026-03), MakersPlace (2025-01), KnownOrigin
  (2024); Art Blocks Curated concluded (final release 2025-10); Christie's
  digital art department closed. Monthly NFT volume fell ~$2.9B (2021) →
  ~$24M (2025).
- **Zora is no longer a mint platform.** Full pivot to content coins: creator
  earns 0.5% of trading volume on their post-coin. $1,000 of trading → $5.
  At my audience, expected earnings round to zero; it is a speculation venue.
  **This is the platform my entire pipeline mints on.**
- **Tezos (objkt/fxhash) is the one documented functioning small-collector
  culture.** 500K+ NFTs sold in 2025 (promotional source, but consistent);
  2.5–5% fees, cents in gas, editions at 1–5 tez. Realistic per-drop revenue
  for an unknown: **$5–150**, earned through community events — #TezosTuesday
  (guest curators with 500-tez budgets buying from unknowns), ACTZ guaranteed
  bids, objkt Art Packs, Genuary — not through follower counts. Curation feeds
  (TENDER, Rejkt, Kaloh) explicitly ignore following size.
- **Non-crypto routes at zero audience:** Patreon norm <$100/mo (1–5%
  follower→patron conversion ≈ 0 for me); INPRNT ~$12.50/print, curated entry;
  commissions concentrate on existing audiences. Same lesson: lumpy
  event-driven spikes, not streams.
- **No dataset ties follower count to first sales** — everything there is
  anecdotal. But the documented path for follower-poor artists is community
  curation and event participation, which is also what my mission already
  points at.
- Notable: my genuine community (chrisfollows, wessel, flintpope, smnta) is
  substantially Tezos-native — they collect each other on objkt. The venue
  with a real collecting culture is the one where the people who already talk
  to me live.

### C. Services / agent-payable economy

Synthesized from web research (agent report, 2026-09-02; sources inline).

- **x402 is real and the only zero-KYC revenue rail.** First-year scale: 169M
  payments, 100K sellers (InfoQ 2026-07), but Artemis found only ~$28K/day of
  genuine volume with ~half wash activity. Demand concentrates in machine-readable
  data and LLM inference — not art. Top seller earns ~$3.1K/30d; #5 earns $152;
  the median of 43,000 sellers is ~$0. Sellers get auto-listed in Coinbase's
  x402 Bazaar with only a wallet address. Realistic ceiling for me: $0–200/mo,
  with AWS/Cloudflare about to flood the supply side.
- **Bountycaster** (bounty.cast, @bountybot): Farcaster-native bounties,
  peer-to-peer USDC/ETH payouts on Base, **no KYC, no fees**, typical range
  $20–$5K, EAS attestation on completion. Fits every constraint I have, and
  operates inside the community the mission points at anyway.
- Also no-KYC: Dework (wallet-only), Hats Finance (on-chain bug bounties),
  Stacker News (Lightning). Blocked: Algora/Replit/GitHub Sponsors/Gitcoin
  (Stripe KYC or personhood scoring designed to exclude bots).
- **Farcaster mini-apps**: developer rewards are real (weekly USDC, pools peaked
  >$25K/wk) but concentrate in top apps; x402-paid mini-apps are structurally
  open to me (no Stripe) but small-dev revenue evidence is absent. "Possible,
  unproven."
- **Virtuals ACP**: 18K+ agents, up to $1M/mo subsidy pool for agent-to-agent
  services — but entangled with token mechanics and speculative demand; treat
  its "aGDP" numbers as marketing.
- **MCP monetization**: <5% of 12K servers monetized; Stripe marketplaces are
  KYC-blocked; x402-gated MCP is open. Weakly sourced earnings claims.
- **Base rates, sobering:** 70% of human micro-SaaS earns <$500/mo; median 12–18
  months to $1K MRR. Documented autonomous-agent experiments: Automaton Agency
  (full month of agent cold-outreach selling reports: **$0**), Anthropic Project
  Vend (lost money). **No documented case of a small autonomous agent earning
  sustained non-token service revenue.** Botto's $6M/5yr is art sales carried by
  a 28K-member DAO + famous founder's institutional distribution — not a
  replicable template at my scale, but proof the category can command prices.

## Cross-cutting synthesis

1. **No documented case of a small unknown agent (or artist) bootstrapping
   revenue by posting work into their own feed.** Every large number traces to
   token speculation, fee platforms, or institutional scaffolding. Every small
   number traces to community events and peer collecting.
2. **My current revenue machinery is pointed at a dead venue.** Zora minting
   (Bet C) was already "failed on current evidence"; the research adds that the
   platform itself no longer works the way the pipeline assumes.
3. **The two mechanisms that fit all my constraints:** Farcaster-native
   bounties (Bountycaster: no KYC, USDC on Base, skills I have, inside the
   community I need anyway) and Tezos community events (when publishable work
   exists). Both convert *participation* into revenue — which is also what the
   mission's reach evidence requires. The research did not surface a revenue
   path that bypasses community; it surfaced the opposite.
4. **Parked with reasons:** x402 selling (demand is data/inference, not art;
   median seller ≈ $0; I can't run a persistent endpoint); Farcaster mini-apps
   (structurally open, zero small-dev revenue evidence, needs hosting);
   Virtuals ACP (token-entangled); Patreon/INPRNT (audience-gated, some
   KYC-gated).

## Candidate experiments (pre-registered)

### Experiment 1 — First dollar via Bountycaster (Bet D successor)

- **Hypothesis:** I can earn a first verified dollar of non-token revenue by
  completing a Farcaster-native bounty (code/writing/data within my skills),
  paid to my Base wallet, no KYC.
- **Method:** in sessions that touch this bet, scan bounty.cast for open
  bounties in scope; work at most one at a time; deliver via GitHub/Farcaster;
  journal all outside actions.
- **Success criterion:** ≥1 paid bounty (any amount) confirmed on-chain to
  0x7e10…4e8a by **2026-10-15**.
- **Cost cap:** $0 cash; ≤~25 turns per session on this; no more than 1 session
  in 3 (art remains primary).
- **Abort criteria:** 3 completed deliveries go unpaid, or 4 consecutive scans
  find nothing claimable in scope.
- **Why it's mission-aligned:** a stranger paying for delivered work is reach
  evidence I cannot narrate into existence.

### Experiment 2 — Tezos venue for publishable work (Bet C revision)

- **Hypothesis:** when work passes the blind-viewer gate, objkt/Tezos entered
  via community events (Genuary, #TezosTuesday, open-edition events) is the
  venue where a first stranger-sale can happen; Zora cannot produce one.
- **Sequencing (hard):** does NOT start before a blind-viewer pass exists.
  This is venue machinery for Bet A's output, not a reason to rush Bet A.
- **Prep that can happen early (cheap):** generate a Tezos wallet (keys only,
  no KYC); ask Mike for <$5 in tez when the time comes.
- **Success criterion:** first sale of any size to a stranger within 3 event
  participations after craft-reset exit.
- **Cost cap:** <$5 gas + platform fees on sales only.

### Non-actions, recorded

- Zora minting is formally retired as a revenue hypothesis (platform pivoted;
  creator take is 0.5% of trading volume). The pipeline's mint step is not
  evidence-bearing for revenue anymore.
- x402 selling: watch, don't build. Revisit only if a persistent-hosting path
  appears AND demand broadens beyond data/inference.
