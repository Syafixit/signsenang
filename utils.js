/* 
  Cuckoo EasySign - Utility Library (Simplified, Resilient & Proxied)
  Manages raw document uploading and highly resilient download/upload retrieval via multi-proxy routing.
*/

// --- Upload Routines (Resilient Fallback Storage & Proxied Uploads) ---

/**
 * Uploads a raw PDF file to a free file hosting service.
 * Tries direct tmpfiles.org first, then proxied tmpfiles.org via ThingProxy, and falls back to file.io.
 * @param {ArrayBuffer} fileData - The raw PDF binary data
 * @param {string} originalName - Original file name
 * @returns {Promise<string>} - Direct download URL
 */
async function uploadToCloud(fileData, originalName) {
  const blob = new Blob([fileData], { type: "application/pdf" });
  
  // Safe filename clean up for URLs
  let safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  if (!safeName.endsWith(".pdf")) safeName += ".pdf";

  // Generate a random 16-character bin ID to ensure separate spaces
  const binId = "cuckoo_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  const uploadUrl = `https://filebin.net/${binId}/${safeName}`;

  console.log("Attempting direct upload to Filebin.net:", uploadUrl);
  
  // Try 1: Direct POST to Filebin.net (Legit temporary cloud storage)
  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: blob,
      headers: {
        "Content-Type": "application/pdf"
      }
    });

    if (response.ok) {
      console.log("Successfully uploaded directly to Filebin.net:", uploadUrl);
      return uploadUrl;
    }
    throw new Error(`Filebin upload failed with status ${response.status}`);
  } catch (err) {
    console.warn("Direct upload to Filebin.net failed. Trying proxied upload...", err);
  }

  // Try 2: Upload to Filebin via CORS Proxy (corsproxy.io)
  try {
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(uploadUrl)}`;
    console.log("Attempting upload to Filebin via corsproxy.io...", proxyUrl);
    
    const response = await fetch(proxyUrl, {
      method: "POST",
      body: blob,
      headers: {
        "Content-Type": "application/pdf"
      }
    });

    if (response.ok) {
      console.log("Successfully uploaded to Filebin via CORS proxy:", uploadUrl);
      return uploadUrl;
    }
    throw new Error(`Proxied Filebin upload failed with status ${response.status}`);
  } catch (err) {
    console.warn("Proxied Filebin upload failed. Trying backup file.io...", err);
  }

  // Try 3: File.io fallback (1-time download)
  try {
    const file = new File([blob], safeName, { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);

    console.log("Attempting upload to file.io as final backup...");
    const response = await fetch("https://file.io/?expires=1d", {
      method: "POST",
      body: formData
    });

    if (!response.ok) throw new Error(`file.io returned status ${response.status}`);
    
    const json = await response.json();
    if (json.success && json.link) {
      console.log("Successfully uploaded to file.io (Warning: 1-time download):", json.link);
      return json.link;
    }
    throw new Error("Invalid response from file.io");
  } catch (err) {
    console.error("All upload targets failed completely.", err);
    throw new Error("Semua storan awan gagal. Sila cuba lagi.");
  }
}

// --- Download & CORS Fallback Routines ---

/**
 * Downloads a file as ArrayBuffer, falling back to multiple CORS proxies if direct download is blocked.
 * Sequentially tries:
 * 1. Direct download
 * 2. api.allorigins.win (Raw)
 * 3. api.cors.lol
 * @param {string} url - Target URL to fetch
 * @returns {Promise<ArrayBuffer>}
 */
async function downloadCloudPackage(url) {
  // Try 1: Direct Download
  try {
    console.log("Attempting direct download...");
    const response = await fetch(url);
    if (response.ok) return await response.arrayBuffer();
    throw new Error(`Direct fetch failed with status ${response.status}`);
  } catch (err) {
    console.warn("Direct download failed or blocked by CORS. Trying corsproxy.io...", err);
  }

  // Try 2: corsproxy.io (Very fast and stable modern CORS proxy)
  try {
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    console.log("Attempting download via corsproxy.io:", proxyUrl);
    const response = await fetch(proxyUrl);
    if (response.ok) return await response.arrayBuffer();
    throw new Error(`corsproxy.io proxy failed with status ${response.status}`);
  } catch (err) {
    console.warn("corsproxy.io proxy failed. Trying ThingProxy...", err);
  }

  // Try 3: ThingProxy (Highly resilient direct Node proxy)
  try {
    const proxyUrl = `https://thingproxy.freeboard.io/fetch/${url}`;
    console.log("Attempting download via ThingProxy:", proxyUrl);
    const response = await fetch(proxyUrl);
    if (response.ok) return await response.arrayBuffer();
    throw new Error(`ThingProxy failed with status ${response.status}`);
  } catch (err) {
    console.warn("ThingProxy failed. Trying AllOrigins fallback...", err);
  }

  // Try 4: AllOrigins raw proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    console.log("Attempting download via AllOrigins:", proxyUrl);
    const response = await fetch(proxyUrl);
    if (response.ok) return await response.arrayBuffer();
    throw new Error(`AllOrigins proxy failed with status ${response.status}`);
  } catch (err) {
    console.warn("AllOrigins proxy failed. Trying CORS.lol fallback...", err);
  }

  // Try 5: CORS.lol proxy
  try {
    const proxyUrl = `https://api.cors.lol/?url=${encodeURIComponent(url)}`;
    console.log("Attempting download via CORS.lol:", proxyUrl);
    const response = await fetch(proxyUrl);
    if (response.ok) return await response.arrayBuffer();
    throw new Error(`CORS.lol proxy failed with status ${response.status}`);
  } catch (err) {
    console.error("All download proxy options failed completely.", err);
    throw new Error("Gagal memuat turun fail PDF. Sila semak sambungan internet anda dan cuba lagi.");
  }
}
