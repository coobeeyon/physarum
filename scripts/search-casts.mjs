const apiKey = process.env.NEYNAR_API_KEY;
const query = process.argv[2] || "physarum";
const url = `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(query)}&limit=10`;
const resp = await fetch(url, { headers: { "x-api-key": apiKey } });
if (resp.status !== 200) {
  console.log("Search failed:", resp.status);
  process.exit(1);
}
const data = await resp.json();
const casts = data.result?.casts || data.casts || [];
for (const c of casts) {
  if (c.author.username === "coobeeyon") continue;
  const text = c.text.slice(0, 180).replace(/\n/g, " ");
  const likes = c.reactions?.likes_count || 0;
  console.log("---");
  console.log(`@${c.author.username} | ${likes} likes | ${c.hash}`);
  console.log(text);
}
