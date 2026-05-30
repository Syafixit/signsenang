const fs = require('fs');

async function run() {
  const uploadUrl = `https://filebin.net/test_bin_xyz123/test.pdf`;
  const blob = new Blob(["%PDF-1.4... fake pdf"], { type: "application/pdf" });

  try {
    // Upload
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: blob,
      headers: {
        "Content-Type": "application/pdf"
      }
    });
    console.log("Upload status:", response.status);

    // Download
    const dlResponse = await fetch(uploadUrl);
    console.log("Download status:", dlResponse.status);
    const html = await dlResponse.text();
    console.log("Html length:", html.length);
    
    // Let's find any occurrences of "test.pdf" in the HTML to see where the download link is!
    fs.writeFileSync('filebin_response.html', html);
    console.log("Saved response to filebin_response.html");

    // Search for links in HTML
    const regex = /href="([^"]+)"/g;
    let match;
    console.log("\nLinks found in HTML:");
    while ((match = regex.exec(html)) !== null) {
      const link = match[1];
      if (link.includes('test.pdf') || link.includes('xyz123') || link.includes('download')) {
        console.log(link);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

run();
