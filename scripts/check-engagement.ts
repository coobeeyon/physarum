const apiKey = process.env.NEYNAR_API_KEY!;
const OUR_FID = 2797211;

const hashes: Record<string, string> = {
  "ed34-primary": "0x9e79aac3fae9fb44eafa214da2d1b8240f67e84a",
  "ed34-zora": "0xe7010aa5bb627bbc9b06d343b00cf149c31517de",
  "ed34-self": "0x44f315f4bac9ccf353aa8ceca995a703ba538c17",
  "ed35-primary": "0xf55cc8d37b64f5e5c622c03ae354e251bfb444c6",
  "ed35-zora": "0xcb40b5236acf913bdabe437ba5a77c956d961bd1",
  "ed35-self": "0xbbce0e68c483df4ffb98969df8271d995c2cda19",
  "ed36-primary": "0xa189b2791865f640ba239c9d7a75ced8018a9afc",
  "ed36-zora": "0x95347178dbbabd350305f452e3d5ff89311172ae",
  "ed36-self": "0x7a35ac28734640f118be690d7a84c66417f29919",
};

console.log("=== ENGAGEMENT CHECK ===\n");

for (const [label, hash] of Object.entries(hashes)) {
  const url = `https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`;
  const resp = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (resp.status !== 200) {
    console.log(label, "HTTP", resp.status);
    continue;
  }
  const data = (await resp.json()) as any;
  const c = data.cast;
  console.log(`${label} | likes: ${c.reactions?.likes_count} recasts: ${c.reactions?.recasts_count} replies: ${c.replies?.count}`);
}

console.log("\n=== INBOUND REPLIES ===\n");

const conversationHashes = [
  "0x9e79aac3fae9fb44eafa214da2d1b8240f67e84a", // ed34 primary
  "0xe7010aa5bb627bbc9b06d343b00cf149c31517de", // ed34 zora
  "0x44f315f4bac9ccf353aa8ceca995a703ba538c17", // ed34 self
  "0xf55cc8d37b64f5e5c622c03ae354e251bfb444c6", // ed35 primary
  "0xcb40b5236acf913bdabe437ba5a77c956d961bd1", // ed35 zora
  "0xbbce0e68c483df4ffb98969df8271d995c2cda19", // ed35 self
  "0xa189b2791865f640ba239c9d7a75ced8018a9afc", // ed36 primary
  "0x95347178dbbabd350305f452e3d5ff89311172ae", // ed36 zora
  "0x7a35ac28734640f118be690d7a84c66417f29919", // ed36 self
];

for (const hash of conversationHashes) {
  const url = `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${hash}&type=hash&reply_depth=2&limit=25`;
  const resp = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (resp.status !== 200) {
    console.log(hash.slice(0, 12), "HTTP", resp.status);
    continue;
  }
  const data = (await resp.json()) as any;
  const replies = data.conversation?.cast?.direct_replies || [];
  const external = replies.filter((r: any) => r.author?.fid !== OUR_FID);
  if (external.length > 0) {
    console.log(`--- Replies to ${hash.slice(0, 12)} ---`);
    for (const r of external) {
      console.log(`  @${r.author?.username} (FID ${r.author?.fid}): ${r.text?.slice(0, 150)}`);
    }
  }
}

// Check follower count
console.log("\n=== FOLLOWERS ===\n");
const userUrl = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${OUR_FID}`;
const userResp = await fetch(userUrl, { headers: { "x-api-key": apiKey } });
if (userResp.status === 200) {
  const userData = (await userResp.json()) as any;
  const user = userData.users?.[0];
  console.log(`Followers: ${user?.follower_count}, Following: ${user?.following_count}`);
  console.log(`Display: ${user?.display_name}, PFP: ${user?.pfp_url?.slice(0, 60)}`);
}
