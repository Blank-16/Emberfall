import http from "node:http";

async function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    }).on("error", reject);
  });
}

async function run() {
  console.log("Checking backend direct endpoints on :8080...");
  const healthDirect = await get("http://localhost:8080/health");
  console.log("Backend /health status:", healthDirect.status, healthDirect.body);
  if (healthDirect.status !== 200 || healthDirect.body?.status !== "ok") {
    throw new Error("Backend /health failed");
  }

  const dungeonsDirect = await get("http://localhost:8080/api/v1/dungeons");
  console.log("Backend /api/v1/dungeons count:", dungeonsDirect.body?.length);
  if (dungeonsDirect.status !== 200 || !Array.isArray(dungeonsDirect.body)) {
    throw new Error("Backend /api/v1/dungeons failed");
  }

  const mapDirect = await get("http://localhost:8080/api/v1/dungeons/d1_emberfall/rooms/d1_entry/map");
  console.log("Backend room map tiled type:", mapDirect.body?.type, "layers:", mapDirect.body?.layers?.length);
  if (mapDirect.status !== 200 || mapDirect.body?.type !== "map") {
    throw new Error("Backend map endpoint failed");
  }

  console.log("\nChecking Vite dev server on :5173...");
  const frontendHome = await get("http://localhost:5173/");
  console.log("Frontend index.html status:", frontendHome.status);
  if (frontendHome.status !== 200) {
    throw new Error("Frontend dev server root failed");
  }

  console.log("\nChecking Vite proxy to backend...");
  const healthViaProxy = await get("http://localhost:5173/health");
  console.log("Vite proxy /health status:", healthViaProxy.status, healthViaProxy.body);
  if (healthViaProxy.status !== 200 || healthViaProxy.body?.status !== "ok") {
    throw new Error("Vite proxy to /health failed");
  }

  const dungeonsViaProxy = await get("http://localhost:5173/api/v1/dungeons");
  console.log("Vite proxy /api/v1/dungeons count:", dungeonsViaProxy.body?.length);
  if (dungeonsViaProxy.status !== 200 || !Array.isArray(dungeonsViaProxy.body)) {
    throw new Error("Vite proxy to /api/v1/dungeons failed");
  }

  console.log("\nAll integration checks passed!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
