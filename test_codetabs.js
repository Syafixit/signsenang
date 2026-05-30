async function testCodeTabs() {
  console.log("Testing Tmpfiles Proxied via CodeTabs...");
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  const file = new File([blob], "test.pdf", { type: "application/pdf" });
  
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("https://api.codetabs.com/v1/proxy?quest=https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData
    });
    console.log("CodeTabs upload status:", response.status);
    const text = await response.text();
    console.log("CodeTabs response:", text);
  } catch (err) {
    console.error("CodeTabs test failed:", err);
  }
}

testCodeTabs();
