async function testTransferSh() {
  console.log("Testing transfer.sh...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });

  try {
    const uploadUrl = "https://transfer.sh/test_cuckoo.pdf";
    console.log("Uploading file to transfer.sh PUT:", uploadUrl);
    
    // Upload using PUT method
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: blob
    });
    
    console.log("Upload status:", response.status);
    const downloadUrl = await response.text();
    console.log("SUCCESS! Download Link:", downloadUrl.trim());
    
    // Let's try downloading it!
    console.log("Testing download from direct link...");
    const dlResponse = await fetch(downloadUrl.trim());
    console.log("Download status:", dlResponse.status);
    const text = await dlResponse.text();
    console.log("Downloaded contents start with:", text.substring(0, 100));
  } catch (err) {
    console.error("transfer.sh test failed:", err);
  }
}

testTransferSh();
