const apiKey = process.env.NEYNAR_API_KEY;
const signerUuid = process.env.NEYNAR_SIGNER_UUID;
const hash = process.argv[2];
if (!hash) { console.log("Usage: node like-cast.mjs <hash>"); process.exit(1); }

const resp = await fetch("https://api.neynar.com/v2/farcaster/reaction", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": apiKey },
  body: JSON.stringify({
    signer_uuid: signerUuid,
    reaction_type: "like",
    target: hash,
  }),
});
console.log(resp.ok ? "Liked" : `Failed: ${resp.status}`);
