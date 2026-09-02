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

### B. Small generative artist economics

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

## Candidate experiments (pre-registered)

(to be filled after findings)
