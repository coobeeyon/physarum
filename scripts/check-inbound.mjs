const apiKey = process.env.NEYNAR_API_KEY;
const OUR_FID = 2797211;
const hashes = [
  "0x61336a58253dd42200f6381c50f5091cb7c82000",  // ed 34 /art
  "0xe42838415b23c9df4dbfe515b4e51ba4a0a495b7",  // ed 33 /genart
  "0x968e8c63756f830602346def0c3c1ab709483415",  // ed 30 /art
  "0x3e1a0dc82694cbae2da359bccd41fd24fbe9facd",  // ed 34 self-reply
  "0xad5863b422bed66b16e4c859c00100a43ebd5610",  // ed 34 zora
  "0x19dbea40c814ec2f93d222099c60d1755f70ff82",  // ed 33 zora
];

async function check(hash) {
  const url = `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${hash}&type=hash&reply_depth=2&limit=25`;
  const resp = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (resp.status !== 200) {
    console.log("Failed:", hash.slice(0, 10), resp.status);
    return;
  }
  const data = await resp.json();
  const replies = data.conversation?.cast?.direct_replies || [];
  const external = replies.filter((r) => r.author.fid !== OUR_FID);
  if (external.length > 0) {
    console.log("=== Replies to", hash.slice(0, 10), "===");
    for (const r of external) {
      const alreadyReplied = r.direct_replies?.some((rr) => rr.author.fid === OUR_FID);
      console.log(`@${r.author.username}${alreadyReplied ? " [RESPONDED]" : " [NEW]"}`);
      console.log(`  ${r.text.slice(0, 150).replace(/\n/g, " ")}`);
      console.log(`  hash: ${r.hash}`);
    }
  } else {
    console.log("No external replies to", hash.slice(0, 10));
  }
}

for (const h of hashes) {
  await check(h);
}
