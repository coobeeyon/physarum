const apiKey = process.env.NEYNAR_API_KEY;
const hash = process.argv[2];
if (!hash) { console.log("Usage: node read-cast.mjs <hash>"); process.exit(1); }

const url = `https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`;
const resp = await fetch(url, { headers: { "x-api-key": apiKey } });
const data = await resp.json();
const cast = data.cast;
console.log(`@${cast.author.username} (${cast.author.display_name})`);
console.log(`Likes: ${cast.reactions?.likes_count} | Replies: ${cast.replies?.count}`);
console.log("---");
console.log(cast.text);
if (cast.embeds?.length) {
  console.log("---");
  console.log("Embeds:", cast.embeds.map(e => e.url || e.cast_id?.hash || "?").join(", "));
}
