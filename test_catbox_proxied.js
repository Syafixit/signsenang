async function testCatboxProxied() {
  console.log("Testing Catbox Proxied via allorigins.win...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  formData.append("fileToUpload", blob, "test.pdf");

  try {
    const response = await fetch("https://api.allorigins.win/raw?url=https://catbox.moe/user/api.php", {
      method: "POST",
      body: formData
    });
    console.log("Catbox proxied upload status:", response.status);
    const text = await response.text();
    console.log("Catbox proxied upload response:", text);
  } catch (err) {
    console.error("Catbox proxied test failed:", err);
  }
}

testCatboxProxied();
