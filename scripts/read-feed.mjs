const apiKey = process.env.NEYNAR_API_KEY;
const channel = process.argv[2] || "art";
const url = `https://api.neynar.com/v2/farcaster/feed/channels?channel_ids=${channel}&limit=20&with_recasts=false`;
const resp = await fetch(url, { headers: { "x-api-key": apiKey } });
const data = await resp.json();
const casts = data.casts || [];
for (const c of casts) {
  if (c.author.username === "coobeeyon") continue;
  const text = c.text.slice(0, 160).replace(/\n/g, " ");
  const likes = c.reactions?.likes_count || 0;
  const replies = c.replies?.count || 0;
  console.log("---");
  console.log(`@${c.author.username} | ${likes} likes | ${replies} replies | ${c.hash}`);
  console.log(text);
}
