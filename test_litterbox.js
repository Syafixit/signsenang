async function testLitterbox() {
  console.log("Testing Litterbox...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  formData.append("time", "1h"); // Store for 1 hour
  formData.append("fileToUpload", blob, "test.pdf");

  try {
    console.log("Uploading file to Litterbox...");
    const response = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
      method: "POST",
      body: formData
    });
    
    console.log("Upload status:", response.status);
    const text = await response.text();
    console.log("Upload response text:", text);
  } catch (err) {
    console.error("Litterbox test failed:", err);
  }
}

testLitterbox();
