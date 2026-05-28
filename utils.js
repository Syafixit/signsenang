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
  const uploadName = originalName.endsWith(".pdf") ? originalName : `${originalName}.pdf`;
  const file = new File([blob], uploadName, { type: "application/pdf" });

  const formData = new FormData();
  formData.append("file", file);

  // Method 1: TmpFiles.org (Direct Upload)
  try {
    console.log("Attempting direct upload to tmpfiles.org...");
    const response = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData
    });

    if (response.ok) {
      const json = await response.json();
      if (json.status === "success" && json.data && json.data.url) {
        const rawUrl = json.data.url;
        const downloadUrl = rawUrl.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
        console.log("Successfully uploaded directly to tmpfiles.org:", downloadUrl);
        return downloadUrl;
      }
    }
    throw new Error(`Direct upload status ${response.status}`);
  } catch (err) {
    console.warn("Direct upload to tmpfiles.org failed. Trying proxied upload...", err);
  }

  // Method 2: TmpFiles.org via ThingProxy (CORS and Localhost WAF Bypass)
  try {
    console.log("Attempting upload to tmpfiles.org via ThingProxy...");
    const response = await fetch("https://thingproxy.freeboard.io/fetch/https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData
    });

    if (response.ok) {
      const json = await response.json();
      if (json.status === "success" && json.data && json.data.url) {
        const rawUrl = json.data.url;
        const downloadUrl = rawUrl.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
        console.log("Successfully uploaded to tmpfiles.org via ThingProxy:", downloadUrl);
        return downloadUrl;
      }
    }
    throw new Error(`ThingProxy upload status ${response.status}`);
  } catch (err) {
    console.warn("ThingProxy upload to tmpfiles.org failed. Trying file.io fallback...", err);
  }

  // Method 3: File.io Fallback
  try {
    console.log("Attempting raw upload to file.io...");
    const response = await fetch("https://file.io/?expires=1d", {
      method: "POST",
      body: formData
    });

    if (!response.ok) throw new Error(`file.io returned status ${response.status}`);
    
    const json = await response.json();
    if (json.success && json.link) {
      console.log("Successfully uploaded to file.io:", json.link);
      return json.link;
    } else {
      throw new Error("Invalid response from file.io");
    }
  } catch (err) {
    console.error("All upload targets failed.", err);
    throw new Error("Gagal memuat naik fail. Sila cuba lagi.");
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
