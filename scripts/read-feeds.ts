const key = process.env.NEYNAR_API_KEY!;
const API = "https://api.neynar.com/v2/farcaster";
const OUR_FID = 2797211;

async function fetchFeed(channel: string) {
  const url = `${API}/feed/channels?channel_ids=${channel}&with_recasts=false&limit=15`;
  const resp = await fetch(url, { headers: { "x-api-key": key } });
  if (resp.status !== 200) {
    console.log(`${channel}: HTTP ${resp.status}`);
    return;
  }
  const data = (await resp.json()) as any;
  console.log(`\n=== /${channel} ===\n`);
  for (const cast of data.casts || []) {
    if (cast.author?.fid === OUR_FID) continue; // skip our own
    const author = cast.author?.username || "?";
    const followers = cast.author?.follower_count || 0;
    const likes = cast.reactions?.likes_count || 0;
    const replies = cast.replies?.count || 0;
    const text = (cast.text || "").substring(0, 250);
    const hash = cast.hash || "?";
    console.log(
      `@${author} (${followers} followers) | ${likes} likes, ${replies} replies | ${hash.substring(0, 14)}`,
    );
    console.log(`  ${text.replace(/\n/g, " ")}`);
    console.log();
  }
}

async function main() {
  await fetchFeed("art");
  await fetchFeed("ai-art");
  await fetchFeed("cryptoart");
  await fetchFeed("ai");
}

main();
