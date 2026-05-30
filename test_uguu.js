async function testUguu() {
  console.log("Testing uguu.se...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  
  const formData = new FormData();
  formData.append("files[]", blob, "test.pdf");

  try {
    console.log("Uploading file to uguu.se...");
    const response = await fetch("https://uguu.se/api.php?d=upload-tool", {
      method: "POST",
      body: formData
    });
    
    console.log("Upload status:", response.status);
    const json = await response.json();
    console.log("Upload response JSON:", JSON.stringify(json));
    
    if (json.success && json.files && json.files.length > 0) {
      const directUrl = json.files[0].url;
      console.log("SUCCESS! Direct Download Link:", directUrl);
      
      // Let's try downloading it!
      console.log("Testing download from direct link...");
      const dlResponse = await fetch(directUrl);
      console.log("Download status:", dlResponse.status);
      const text = await dlResponse.text();
      console.log("Downloaded contents start with:", text.substring(0, 100));
    } else {
      throw new Error("Invalid Uguu response");
    }
  } catch (err) {
    console.error("uguu.se test failed:", err);
  }
}

testUguu();
