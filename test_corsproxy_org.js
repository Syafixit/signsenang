async function testCorsProxyOrg() {
  console.log("Testing Tmpfiles Proxied via corsproxy.org...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  const file = new File([blob], "test.pdf", { type: "application/pdf" });
  
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("https://corsproxy.org/?https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData
    });
    console.log("corsproxy.org status:", response.status);
    const text = await response.text();
    console.log("corsproxy.org response:", text.substring(0, 200));
  } catch (err) {
    console.error("corsproxy.org test failed:", err);
  }
}

testCorsProxyOrg();
