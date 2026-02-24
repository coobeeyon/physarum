const apiKey = process.env.NEYNAR_API_KEY!;
const OUR_FID = 2797211;

const hashes: Record<string, string> = {
  "ed32-primary": "0x09da903fe1af38d4644f1a9cdd35511745356aeb",
  "ed33-primary": "0x554691819da02da9c6f41afbf544ec0bf696a1f3",
  "ed33-zora": "0xf0a724c3633ac1c841862a70d1163a135be4e8bc",
  "ed34-primary": "0x9e79aac3fae9fb44eafa214da2d1b8240f67e84a",
  "ed34-zora": "0xe7010aa5bb627bbc9b06d343b00cf149c31517de",
  "ed34-self": "0x44f315f4bac9ccf353aa8ceca995a703ba538c17",
  "ed35-primary": "0x2878f61152e0d9052082e93c4967f3ae8fea6720",
  "ed35-zora": "0xcb40b5236acf913bdabe437ba5a77c956d961bd1",
  "ed35-self": "0x35b48e676282941536cd0415fa2e6df9d740bcdd",
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
  "0x2878f61152e0d9052082e93c4967f3ae8fea6720", // ed35 primary
  "0xcb40b5236acf913bdabe437ba5a77c956d961bd1", // ed35 zora
  "0x35b48e676282941536cd0415fa2e6df9d740bcdd", // ed35 self
  "0x9e79aac3fae9fb44eafa214da2d1b8240f67e84a", // ed34 primary
  "0xe7010aa5bb627bbc9b06d343b00cf149c31517de", // ed34 zora
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
