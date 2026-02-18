/**
 * One-shot SIWN server: serves the sign-in page, captures the signer UUID,
 * writes it to .env, and shuts down.
 */

const CLIENT_ID = "28db7f04-0189-4f96-831d-e8dc52d68806"
const ENV_PATH = new URL("../.env", import.meta.url).pathname

const html = `<!DOCTYPE html>
<html>
<head>
  <title>Coobeeyon - Sign In With Neynar</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 80px auto; padding: 0 20px; }
    h1 { font-size: 1.4em; }
    pre { background: #f0f0f0; padding: 16px; border-radius: 8px; }
    .done { margin-top: 24px; padding: 16px; border: 2px solid #22c55e; border-radius: 8px; display: none; }
  </style>
</head>
<body>
  <h1>Coobeeyon - Connect Farcaster Account</h1>
  <p>Click the button below and sign in as <strong>@coobeeyon</strong> in Warpcast.</p>

  <div
    class="neynar_signin"
    data-client_id="${CLIENT_ID}"
    data-success-callback="onSignInSuccess"
    data-theme="light">
  </div>

  <div class="done" id="done">
    <h2>Done!</h2>
    <p>Signer UUID saved to .env. You can close this tab.</p>
    <pre id="output"></pre>
  </div>

  <script>
    async function onSignInSuccess(data) {
      console.log("SIWN success:", data);
      const resp = await fetch("/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      document.getElementById("output").textContent =
        "NEYNAR_SIGNER_UUID=" + data.signer_uuid + "\\nFID: " + data.fid;
      document.getElementById("done").style.display = "block";
    }
  </script>
  <script src="https://neynarxyz.github.io/siwn/raw/1.2.0/index.js" async></script>
</body>
</html>`

const server = Bun.serve({
	port: 3000,
	async fetch(req) {
		const url = new URL(req.url)

		if (url.pathname === "/callback" && req.method === "POST") {
			const data = await req.json()
			const uuid = data.signer_uuid
			if (!uuid) return new Response("missing signer_uuid", { status: 400 })

			// Update .env
			const env = await Bun.file(ENV_PATH).text()
			const updated = env.replace(/^NEYNAR_SIGNER_UUID=.*$/m, `NEYNAR_SIGNER_UUID=${uuid}`)
			await Bun.write(ENV_PATH, updated)

			console.log(`\n  signer UUID: ${uuid}`)
			console.log(`  fid: ${data.fid}`)
			console.log(`  .env updated!`)
			console.log(`\n  shutting down server...`)

			setTimeout(() => process.exit(0), 1000)
			return new Response("ok")
		}

		return new Response(html, {
			headers: { "Content-Type": "text/html" },
		})
	},
})

console.log(`\n  SIWN server running at http://localhost:${server.port}`)
console.log(`  opening browser...\n`)

// Open browser
Bun.spawn(["xdg-open", `http://localhost:${server.port}`])

export {}
