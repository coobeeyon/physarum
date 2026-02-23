// Check conversations I participated in last session
// My reply hashes from edition 34 state.json
const apiKey = process.env.NEYNAR_API_KEY;
const OUR_FID = 2797211;

// My replies from last session (stored in ed 34 replyCastHashes)
const myReplyHashes = [
  "0x65113e0e2b1a85087fe91c838a3c4526ff2e38c7",
  "0x741c1921447e8e86d000a85a9710d5899a3225b0",
  "0xb09259ef193f29473b03d29d43078ebb2a74e03b",
  "0x6b3e518849272d5db4c9716d78ada6478a80e341",
  "0xf49811be12e8f0178d1c7b5eaf30147832d16441",
  "0x22541908110104199a4292c7095e0144f8b25fdd",
];

async function check(hash) {
  const url = `https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`;
  const resp = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (resp.status !== 200) {
    console.log("Failed:", hash.slice(0, 10), resp.status);
    return;
  }
  const data = await resp.json();
  const cast = data.cast;
  const likes = cast?.reactions?.likes_count || 0;
  const replies = cast?.replies?.count || 0;
  const text = cast?.text?.slice(0, 80)?.replace(/\n/g, " ") || "?";
  console.log(`${hash.slice(0,10)} | ${likes} likes | ${replies} replies`);
  console.log(`  "${text}"`);

  // Check if anyone replied to this reply
  if (replies > 0) {
    const convUrl = `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${hash}&type=hash&reply_depth=1&limit=10`;
    const convResp = await fetch(convUrl, { headers: { "x-api-key": apiKey } });
    if (convResp.status === 200) {
      const convData = await convResp.json();
      const childReplies = convData.conversation?.cast?.direct_replies || [];
      for (const r of childReplies) {
        console.log(`  → @${r.author.username}: "${r.text.slice(0, 100).replace(/\n/g, " ")}"`);
        console.log(`    hash: ${r.hash}`);
      }
    }
  }
}

for (const h of myReplyHashes) {
  await check(h);
}
