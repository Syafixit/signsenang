async function testProxy(name, proxyUrl) {
  console.log(`\nTesting proxy: ${name}...`);
  const fileBytes = Buffer.from("%PDF-1.4... fake pdf contents");
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  const file = new File([blob], "test.pdf", { type: "application/pdf" });
  const formData = new FormData();
  formData.append("file", file);

  try {
    const url = `${proxyUrl}https://tmpfiles.org/api/v1/upload`;
    console.log("Fetching url:", url);
    const response = await fetch(url, {
      method: "POST",
      body: formData
    });
    console.log(`${name} status:`, response.status);
    const text = await response.text();
    console.log(`${name} response sample:`, text.substring(0, 200));
  } catch (err) {
    console.error(`${name} failed:`, err);
  }
}

async function run() {
  await testProxy("ThingProxy", "https://thingproxy.freeboard.io/fetch/");
}

run();
