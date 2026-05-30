async function testBridge() {
  console.log("Testing Tmpfiles Proxied via Bridge.wtf...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  const file = new File([blob], "test.pdf", { type: "application/pdf" });
  
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("https://cors.bridge.wtf/https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData
    });
    console.log("Bridge.wtf status:", response.status);
    const text = await response.text();
    console.log("Bridge.wtf response:", text);
  } catch (err) {
    console.error("Bridge.wtf test failed:", err);
  }
}

testBridge();
