async function testGofile() {
  console.log("Testing GoFile...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  const file = new File([blob], "test.pdf", { type: "application/pdf" });

  try {
    // Step 1: Get best server
    console.log("Fetching GoFile best server...");
    const serverResponse = await fetch("https://api.gofile.io/servers");
    const serverJson = await serverResponse.json();
    console.log("Server response:", JSON.stringify(serverJson));
    
    if (serverJson.status !== "ok" || !serverJson.data || !serverJson.data.servers || serverJson.data.servers.length === 0) {
      throw new Error("Failed to get GoFile server");
    }
    
    const serverName = serverJson.data.servers[0].name;
    console.log("Using server:", serverName);

    // Step 2: Upload file
    const formData = new FormData();
    formData.append("file", file);

    const uploadUrl = `https://${serverName}.gofile.io/contents/uploadfile`;
    console.log("Uploading file to GoFile:", uploadUrl);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: formData
    });
    
    const uploadJson = await uploadResponse.json();
    console.log("Upload response:", JSON.stringify(uploadJson));

    if (uploadJson.status === "ok" && uploadJson.data && uploadJson.data.directLink) {
      const directLink = uploadJson.data.directLink;
      console.log("SUCCESS! Direct Link:", directLink);
      
      // Let's try downloading it!
      console.log("Testing download from direct link...");
      const dlResponse = await fetch(directLink);
      console.log("Download status:", dlResponse.status);
      const text = await dlResponse.text();
      console.log("Downloaded contents start with:", text.substring(0, 100));
    } else {
      throw new Error("Invalid GoFile response: " + JSON.stringify(uploadJson));
    }
  } catch (err) {
    console.error("GoFile test failed:", err);
  }
}

testGofile();
