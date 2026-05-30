async function testDownload() {
  const directLink = "https://store-eu-par-1.gofile.io/download/web/8f03c582-fa05-420f-bcd9-2776378dd4c8/test.pdf";
  try {
    const response = await fetch(directLink);
    console.log("Download status:", response.status);
    const text = await response.text();
    console.log("Downloaded content starts with:", text.substring(0, 100));
  } catch (err) {
    console.error("Download failed:", err);
  }
}

testDownload();
