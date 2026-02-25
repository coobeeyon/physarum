const key = process.env.NEYNAR_API_KEY!;
const API = "https://api.neynar.com/v2/farcaster";

async function checkUser(username: string) {
  const userResp = await fetch(`${API}/user/by_username?username=${username}`, {
    headers: { "x-api-key": key },
  });
  if (userResp.status !== 200) {
    console.log(`${username}: HTTP ${userResp.status}`);
    return;
  }
  const userData = (await userResp.json()) as any;
  const fid = userData.user?.fid;
  console.log(`\n@${username} FID: ${fid} followers: ${userData.user?.follower_count}`);

  // Get recent casts
  const feedResp = await fetch(
    `${API}/feed/user/casts?fid=${fid}&limit=8&include_replies=true`,
    { headers: { "x-api-key": key } },
  );
  if (feedResp.status !== 200) {
    console.log(`feed: HTTP ${feedResp.status}`);
    return;
  }
  const feedData = (await feedResp.json()) as any;
  for (const cast of feedData.casts || []) {
    const likes = cast.reactions?.likes_count || 0;
    const replies = cast.replies?.count || 0;
    const text = (cast.text || "").substring(0, 280);
    const hash = (cast.hash || "").substring(0, 14);
    const parentHash = cast.parent_hash
      ? ` (reply to ${cast.parent_hash.substring(0, 14)})`
      : "";
    console.log(
      `\n  ${hash}${parentHash} | ${likes} likes, ${replies} replies`,
    );
    console.log(`  ${text.replace(/\n/g, " ")}`);
  }
}

async function main() {
  const users = process.argv.slice(2);
  if (users.length === 0) {
    console.log("Usage: bun run scripts/check-users.ts <username1> <username2> ...");
    return;
  }
  for (const u of users) {
    await checkUser(u);
    console.log("\n---");
  }
}

main();
