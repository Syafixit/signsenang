async function testPixeldrain() {
  console.log("Testing Pixeldrain...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  const formData = new FormData();
  formData.append("file", blob, "test.pdf");

  try {
    console.log("Uploading file to Pixeldrain...");
    const response = await fetch("https://pixeldrain.com/api/file", {
      method: "POST",
      body: formData
    });
    
    console.log("Upload status:", response.status);
    const json = await response.json();
    console.log("Upload response JSON:", JSON.stringify(json));
    
    if (json.success && json.id) {
      const directUrl = `https://pixeldrain.com/api/file/${json.id}`;
      console.log("SUCCESS! Direct Download Link:", directUrl);
      
      // Let's try downloading it!
      console.log("Testing download from direct link...");
      const dlResponse = await fetch(directUrl);
      console.log("Download status:", dlResponse.status);
      const text = await dlResponse.text();
      console.log("Downloaded contents start with:", text.substring(0, 100));
    } else {
      throw new Error("Invalid Pixeldrain response");
    }
  } catch (err) {
    console.error("Pixeldrain test failed:", err);
  }
}

testPixeldrain();
