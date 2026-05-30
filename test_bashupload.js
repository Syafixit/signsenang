async function testBashupload() {
  console.log("Testing Bashupload...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  
  try {
    console.log("Uploading file to Bashupload...");
    const response = await fetch("https://bashupload.com/test_cuckoo.pdf", {
      method: "POST", // or PUT
      body: fileBytes
    });
    
    console.log("Upload status:", response.status);
    const text = await response.text();
    console.log("Upload response text:", text);
    
    if (response.ok && text.includes("https")) {
      const downloadUrl = text.trim();
      console.log("SUCCESS! Download Link:", downloadUrl);
      
      // Let's try downloading it!
      console.log("Testing download from direct link...");
      const dlResponse = await fetch(downloadUrl);
      console.log("Download status:", dlResponse.status);
      const textDl = await dlResponse.text();
      console.log("Downloaded contents start with:", textDl.substring(0, 100));
    } else {
      throw new Error("Invalid Bashupload response");
    }
  } catch (err) {
    console.error("Bashupload test failed:", err);
  }
}

testBashupload();
