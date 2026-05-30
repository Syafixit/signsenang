const fs = require('fs');

async function testFilebin() {
  console.log("Testing Filebin...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const binId = "test_cuckoo_" + Math.random().toString(36).substring(2, 10);
  const uploadUrl = `https://filebin.net/${binId}/test.pdf`;

  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: fileBytes,
      headers: {
        "Content-Type": "application/pdf"
      }
    });
    console.log("Filebin upload status:", response.status);
    if (response.ok) {
      console.log("Filebin upload success. URL:", uploadUrl);
      
      // Let's try downloading it!
      const dlResponse = await fetch(uploadUrl);
      console.log("Filebin download status:", dlResponse.status);
      const text = await dlResponse.text();
      console.log("Filebin download content starts with:", text.substring(0, 100));
    }
  } catch (err) {
    console.error("Filebin test failed:", err);
  }
}

async function testTmpfilesDirect() {
  console.log("\nTesting Tmpfiles Direct...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  const file = new File([blob], "test.pdf", { type: "application/pdf" });
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData
    });
    console.log("Tmpfiles upload status:", response.status);
    const json = await response.json();
    console.log("Tmpfiles upload response:", JSON.stringify(json));
  } catch (err) {
    console.error("Tmpfiles direct test failed:", err);
  }
}

async function testTmpfilesProxied() {
  console.log("\nTesting Tmpfiles Proxied via allorigins.win...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  const file = new File([blob], "test.pdf", { type: "application/pdf" });
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("https://api.allorigins.win/raw?url=https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData
    });
    console.log("Tmpfiles proxied upload status:", response.status);
    const json = await response.json();
    console.log("Tmpfiles proxied upload response:", JSON.stringify(json));
  } catch (err) {
    console.error("Tmpfiles proxied test failed:", err);
  }
}

async function run() {
  await testFilebin();
  await testTmpfilesDirect();
  await testTmpfilesProxied();
}

run();
