/* 
  Cuckoo EasySign - Utility Library (Simplified, Resilient & Proxied)
  Manages raw document uploading and highly resilient download/upload retrieval via multi-proxy routing.
*/

// --- Upload Routines (Resilient Fallback Storage & Proxied Uploads) ---

/**
 * Uploads a raw PDF file to a free file hosting service.
 * Tries direct litterbox (catbox.moe) first (72h storage, natively CORS-enabled upload & download),
 * then falls back to direct tmpfiles.org, and finally direct uguu.se.
 * @param {ArrayBuffer} fileData - The raw PDF binary data
 * @param {string} originalName - Original file name
 * @returns {Promise<string>} - Direct download URL
 */
async function uploadToCloud(fileData, originalName) {
  const blob = new Blob([fileData], { type: "application/pdf" });
  
  // Safe filename clean up
  let safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  if (!safeName.endsWith(".pdf")) safeName += ".pdf";

  const file = new File([blob], safeName, { type: "application/pdf" });

  // Try 1: Litterbox (Catbox.moe) - Direct, Natively CORS-enabled, stores for 72 hours
  try {
    console.log("Attempting direct upload to Litterbox (Catbox.moe)...");
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("time", "72h");
    formData.append("fileToUpload", file);

    const response = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
      method: "POST",
      body: formData
    });

    if (response.ok) {
      const downloadUrl = await response.text();
      if (downloadUrl && downloadUrl.trim().startsWith("http")) {
        console.log("Successfully uploaded to Litterbox:", downloadUrl.trim());
        return downloadUrl.trim();
      }
    }
    throw new Error(`Litterbox returned status ${response.status}`);
  } catch (err) {
    console.warn("Direct upload to Litterbox failed. Trying direct Tmpfiles fallback...", err);
  }

  // Try 2: TmpFiles.org - Direct fallback
  try {
    console.log("Attempting direct upload to tmpfiles.org...");
    const formDataTmp = new FormData();
    formDataTmp.append("file", file);

    const response = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formDataTmp
    });

    if (response.ok) {
      const json = await response.json();
      if (json.status === "success" && json.data && json.data.url) {
        const rawUrl = json.data.url;
        // Transform view link to raw download link!
        const downloadUrl = rawUrl.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
        console.log("Successfully uploaded to tmpfiles.org direct:", downloadUrl);
        return downloadUrl;
      }
    }
    throw new Error(`tmpfiles.org returned status ${response.status}`);
  } catch (err) {
    console.warn("Direct upload to tmpfiles.org failed. Trying direct Uguu.se fallback...", err);
  }

  // Try 3: Uguu.se - Direct fallback
  try {
    console.log("Attempting direct upload to uguu.se...");
    const formDataUguu = new FormData();
    formDataUguu.append("files[]", file);

    const response = await fetch("https://uguu.se/api.php?d=upload-tool", {
      method: "POST",
      body: formDataUguu
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success && json.files && json.files[0] && json.files[0].url) {
        const downloadUrl = json.files[0].url;
        console.log("Successfully uploaded to Uguu.se direct:", downloadUrl);
        return downloadUrl;
      }
    }
    throw new Error(`uguu.se returned status ${response.status}`);
  } catch (err) {
    console.error("All upload targets failed completely.", err);
    throw new Error("Gagal memuat naik fail ke awan. Sila cuba lagi.");
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
