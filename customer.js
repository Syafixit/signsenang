/* 
  SignSenang - Customer Signature Portal Controller (Advanced Zoom & Position)
  Manages file download, sessionStorage local retrieval, viewport rendering, 
  highly resilient percentage-based signature dragging/resizing, and PDF-Lib stitching.
*/

document.addEventListener("DOMContentLoaded", async () => {
  // Global States
  let decryptedPdfBytes = null;
  let pdfDoc = null;
  let currentPageIndex = 0;
  let pdfjsDocInstance = null;
  let zoomLevel = 1.0; // Dynamic zoom factor
  
  let signaturePad = null;
  let signatureData = null; // base64 PNG
  
  // Positional status of signature (stored as percentage relative to canvas)
  let signaturePosition = {
    pageIndex: 0,
    xPercent: 0, 
    yPercent: 0,
    wPercent: 0.25, // default 25% of canvas width
    hPercent: 0.125 // default 12.5% of canvas height (2:1 aspect ratio)
  };

  // DOM Elements
  const loadingPanel = document.getElementById("loading-panel");
  const loadingStatus = document.getElementById("loading-status");
  const workspacePanel = document.getElementById("workspace-panel");
  const successPanel = document.getElementById("success-panel");
  
  const pdfWrapper = document.getElementById("pdf-wrapper");
  const pdfCanvas = document.getElementById("pdf-canvas");
  const pageNumIndicator = document.getElementById("page-num-indicator");
  const prevPageBtn = document.getElementById("prev-page-btn");
  const nextPageBtn = document.getElementById("next-page-btn");
  
  // Zoom elements
  const zoomInBtn = document.getElementById("zoom-in-btn");
  const zoomOutBtn = document.getElementById("zoom-out-btn");
  const zoomVal = document.getElementById("zoom-val");
  
  const openSignModalBtn = document.getElementById("open-sign-modal-btn");
  const stepInstruction = document.getElementById("step-instruction");
  const downloadSignedPdfBtn = document.getElementById("download-signed-pdf-btn");
  
  // Modal DOM Elements
  const sigModalOverlay = document.getElementById("signature-modal-overlay");
  const sigCanvas = document.getElementById("signature-canvas");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const clearSigBtn = document.getElementById("clear-signature-btn");
  const saveSigBtn = document.getElementById("save-signature-btn");

  // --- Step 1: Bind Manual Upload Buttons & Triggers ---
  const customerUploadBtn = document.getElementById("customer-upload-btn");
  const customerFileInput = document.getElementById("customer-file-input");

  if (customerUploadBtn && customerFileInput) {
    customerUploadBtn.addEventListener("click", () => customerFileInput.click());
    customerFileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        processManualUploadedFile(e.target.files[0]);
      }
    });
  }

  // Global click/tap outside handler to safely unselect signature
  document.addEventListener("mousedown", (e) => {
    const target = e.target;
    if (target && typeof target.closest === "function") {
      if (!target.closest("#sig-overlay") && !target.closest("#open-sign-modal-btn")) {
        const overlay = document.getElementById("sig-overlay");
        if (overlay) overlay.classList.remove("editing");
      }
    }
  });
  document.addEventListener("touchstart", (e) => {
    const target = e.target;
    if (target && typeof target.closest === "function") {
      if (!target.closest("#sig-overlay") && !target.closest("#open-sign-modal-btn")) {
        const overlay = document.getElementById("sig-overlay");
        if (overlay) overlay.classList.remove("editing");
      }
    }
  });

  // Helper to open the drawing modal and ensure high-DPI canvas resizing
  function openSignatureModal() {
    if (sigModalOverlay) {
      sigModalOverlay.classList.add("active");
      setTimeout(resizeSignatureModalCanvas, 200);
    }
  }

  async function processManualUploadedFile(file) {
    try {
      loadingPanel.style.display = "block";
      workspacePanel.style.display = "none";
      successPanel.style.display = "none";

      loadingStatus.textContent = "Membaca fail PDF secara lokal...";

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          decryptedPdfBytes = reader.result;
          
          loadingPanel.style.display = "none";
          workspacePanel.style.display = "block";
          document.body.classList.add("customer-active");
          
          loadingStatus.textContent = "Menyediakan ruang tandatangan...";
          await initPdfWorkspace();
          
          // Auto-trigger customer signature canvas modal immediately
          openSignatureModal();
        } catch (err) {
          console.error("Gagal memproses fail manual:", err);
          alert("Gagal membaca fail PDF: " + err.message);
          window.location.reload();
        }
      };
      reader.onerror = () => {
        alert("Gagal membaca fail PDF.");
        window.location.reload();
      };
      reader.readAsArrayBuffer(file);
    } catch (e) {
      console.error(e);
      alert("Gagal memproses fail.");
    }
  }

  // --- Step 2: Parse Parameters & Initialize Download (Dual-Path) ---

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get("mode");
    const fileUrl = urlParams.get("file");

    if (mode === "local") {
      loadingStatus.textContent = "Membuka dokumen tempatan secara terus (100% offline)...";
      
      const base64 = sessionStorage.getItem("localPdfBytes");
      if (!base64) {
        throw new Error("Data borang PDF tempatan tidak dijumpai. Sila muat naik semula di halaman utama.");
      }

      decryptedPdfBytes = base64ToArrayBuffer(base64);
      
      loadingPanel.style.display = "none";
      workspacePanel.style.display = "block";
      document.body.classList.add("customer-active");

      // Initialize PDF.js and PDF-Lib workspace
      loadingStatus.textContent = "Menyediakan ruang tandatangan...";
      await initPdfWorkspace();
      
      // Auto-trigger customer signature canvas modal immediately
      openSignatureModal();

    } else if (fileUrl) {
      loadingStatus.textContent = "Menyambung ke storan awan untuk memuat turun PDF...";
      const rawPdfData = await downloadCloudPackage(fileUrl);
      decryptedPdfBytes = rawPdfData;
      
      loadingPanel.style.display = "none";
      workspacePanel.style.display = "block";
      document.body.classList.add("customer-active");

      // Initialize PDF.js and PDF-Lib workspace
      loadingStatus.textContent = "Menyediakan ruang tandatangan...";
      await initPdfWorkspace();
      
      // Auto-trigger customer signature canvas modal immediately
      openSignatureModal();

    } else {
      // Direct open without arguments - show manual upload prompt immediately instead of error
      loadingStatus.textContent = "Sila muat naik fail PDF Cuckoo untuk mula menandatangani.";
      const spinner = loadingPanel.querySelector(".spinner");
      if (spinner) spinner.style.display = "none";
      
      const statusText = document.getElementById("loading-status");
      if (statusText) statusText.textContent = "Sila klik butang di bawah untuk memilih fail PDF yang telah diisi oleh ejen.";
      
      const mainHeader = loadingPanel.querySelector("h2");
      if (mainHeader) mainHeader.textContent = "Muat Naik Fail PDF Cuckoo";
    }

  } catch (error) {
    console.error("Initialization failure:", error);
    loadingPanel.innerHTML = `
      <div class="logo-icon" style="background: var(--danger); width: 60px; height: 60px; margin: 0 auto 2rem;">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h2 style="color: var(--danger); margin-bottom: 1rem;">Gagal Membuka Fail</h2>
      <p class="subtitle" style="margin-bottom: 1.5rem;">${error.message || "Sila pastikan fail anda adalah lengkap dan sah."}</p>
      
      <!-- Manual upload fallback option on error -->
      <div style="background: rgba(220,38,38,0.02); border: 1px dashed rgba(220,38,38,0.15); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; width: 100%; max-width: 450px; margin-left: auto; margin-right: auto;">
        <p class="subtitle" style="margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: bold; color: var(--text-primary);">Pilihan Alternatif Offline:</p>
        <p class="subtitle" style="margin-bottom: 0.5rem; font-size: 0.8rem; text-align: center;">Dapatkan fail PDF daripada ejen anda melalui WhatsApp, muat naik di bawah untuk tandatangan secara offline:</p>
        <input type="file" id="customer-file-input-error" accept="application/pdf" style="display: none;">
        <button class="btn btn-primary" id="customer-upload-btn-error" style="padding: 0.7rem 1.5rem; font-size: 0.9rem;">
          <i class="fa-solid fa-cloud-arrow-up"></i> Muat Naik PDF Manual
        </button>
      </div>

      <a href="index.html" class="btn btn-secondary"><i class="fa-solid fa-arrow-left"></i> Kembali Ke Laman Utama</a>
    `;

    // Bind upload triggers on the error screen
    const uploadBtnError = document.getElementById("customer-upload-btn-error");
    const fileInputError = document.getElementById("customer-file-input-error");
    if (uploadBtnError && fileInputError) {
      uploadBtnError.addEventListener("click", () => fileInputError.click());
      fileInputError.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          processManualUploadedFile(e.target.files[0]);
        }
      });
    }
  }

  // --- Helper: Base64 to ArrayBuffer ---
  function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // --- Step 2: PDF Rendering Workspace Setup ---

  async function initPdfWorkspace() {
    // Configure PDF.js global worker
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // Load PDF via PDF.js
    const pdfBytesForPDFjs = decryptedPdfBytes.slice(0);
    pdfjsDocInstance = await pdfjsLib.getDocument({ data: pdfBytesForPDFjs }).promise;
    
    // Load PDF via PDF-Lib (for stitching later)
    const pdfBytesForPDFLib = decryptedPdfBytes.slice(0);
    pdfDoc = await PDFLib.PDFDocument.load(pdfBytesForPDFLib);

    currentPageIndex = 0;
    zoomLevel = 1.0;
    zoomVal.textContent = "100%";

    // Zoom bindings
    zoomInBtn.onclick = () => adjustZoom(0.2);
    zoomOutBtn.onclick = () => adjustZoom(-0.2);

    // Navigation setup
    prevPageBtn.addEventListener("click", () => navigatePage(-1));
    nextPageBtn.addEventListener("click", () => navigatePage(1));
    
    // Setup modal elements
    initSignatureModal();

    // PDF Canvas Click Listener - clicking on the canvas unselects the signature overlay
    pdfCanvas.addEventListener("click", (e) => {
      const overlay = document.getElementById("sig-overlay");
      if (overlay) {
        overlay.classList.remove("editing");
      }
    });

    await renderPage(currentPageIndex);
  }

  function adjustZoom(amount) {
    const nextZoom = zoomLevel + amount;
    if (nextZoom >= 0.6 && nextZoom <= 2.0) {
      zoomLevel = Math.round(nextZoom * 10) / 10;
      zoomVal.textContent = `${Math.round(zoomLevel * 100)}%`;
      renderPage(currentPageIndex);
    }
  }

  async function renderPage(index) {
    if (!pdfjsDocInstance) return;

    // Fetch page
    const page = await pdfjsDocInstance.getPage(index + 1);
    
    // Determine dynamic responsive viewport scaling
    // On mobile screens <= 1024px, force containerWidth to window.innerWidth to completely bypass any clientWidth flexbox bugs!
    const isMobile = window.innerWidth <= 1024;
    const containerWidth = isMobile ? window.innerWidth : (document.querySelector("#workspace-panel .pdf-viewer-container")?.clientWidth || 750);
    const originalViewport = page.getViewport({ scale: 1.0 });
    
    // Base fit scale * user zoom factor
    const baseScale = containerWidth / originalViewport.width;
    const finalScale = baseScale * zoomLevel;
    const viewport = page.getViewport({ scale: finalScale });

    // Set wrapper dimensions to align overlays correctly
    pdfWrapper.style.width = `${viewport.width}px`;
    pdfWrapper.style.height = `${viewport.height}px`;

    // Prepare HTML5 canvas context
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    const context = pdfCanvas.getContext("2d");

    // Render page contents
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    await page.render(renderContext).promise;

    // Update indicator
    pageNumIndicator.textContent = `Halaman ${index + 1} / ${pdfjsDocInstance.numPages}`;

    // Manage signature display
    toggleSignatureOverlayVisibility();
  }

  async function navigatePage(direction) {
    const nextIndex = currentPageIndex + direction;
    if (nextIndex >= 0 && nextIndex < pdfjsDocInstance.numPages) {
      currentPageIndex = nextIndex;
      await renderPage(currentPageIndex);
    }
  }

  window.addEventListener("resize", () => {
    if (pdfjsDocInstance) {
      renderPage(currentPageIndex);
    }
  });

  // --- Step 3: Signature Drawing Pad Modal Logic ---

  function initSignatureModal() {
    sigCanvas.width = 460;
    sigCanvas.height = 220;

    // Premium fine black ink ballpoint pen stroke settings with guaranteed alpha channel transparency
    signaturePad = new SignaturePad(sigCanvas, {
      backgroundColor: "rgba(0, 0, 0, 0)",
      penColor: "rgb(0, 0, 0)", 
      minWidth: 0.8, 
      maxWidth: 2.2, 
      velocityFilterWeight: 0.6 
    });

    window.addEventListener("resize", resizeSignatureModalCanvas);
    
    openSignModalBtn.addEventListener("click", () => {
      sigModalOverlay.classList.add("active");
      setTimeout(resizeSignatureModalCanvas, 100);
    });

    closeModalBtn.addEventListener("click", () => {
      sigModalOverlay.classList.remove("active");
    });

    clearSigBtn.addEventListener("click", () => {
      signaturePad.clear();
    });

    saveSigBtn.addEventListener("click", () => {
      if (signaturePad.isEmpty()) {
        alert("Sila tulis tandatangan anda sebelum menyimpan.");
        return;
      }

      // Get the raw signature canvas
      const rawCanvas = sigCanvas;
      
      // Guarantee 100% transparency by creating a temporary canvas and removing any white/near-white backgrounds
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = rawCanvas.width;
      tempCanvas.height = rawCanvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      
      // Draw original canvas content onto temporary canvas
      tempCtx.drawImage(rawCanvas, 0, 0);
      
      // Process pixels to remove light gray or white background
      try {
        const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          // If a pixel is pure white or very close to it (RGB all above 240), make it transparent
          if (r > 240 && g > 240 && b > 240) {
            data[i+3] = 0; // set alpha channel to 0
          }
        }
        tempCtx.putImageData(imgData, 0, 0);
        signatureData = tempCanvas.toDataURL("image/png");
      } catch (err) {
        console.warn("Ralat penapisan pixel transparansi, guna kaedah laluan terus:", err);
        signatureData = signaturePad.toDataURL("image/png");
      }
      
      // Calculate centered percentages relative to current canvas
      const w = 150;
      const h = 75;
      const x = (pdfCanvas.width / 2) - 75;
      const y = (pdfCanvas.height / 2) - 37.5;

      signaturePosition.pageIndex = currentPageIndex;
      signaturePosition.xPercent = x / pdfCanvas.width;
      signaturePosition.yPercent = y / pdfCanvas.height;
      signaturePosition.wPercent = w / pdfCanvas.width;
      signaturePosition.hPercent = h / pdfCanvas.height;

      createDraggableSignatureOverlay();

      sigModalOverlay.classList.remove("active");
      stepInstruction.innerHTML = `Langkah 2: <strong>Seret & Letak</strong> tandatangan di tempat yang betul pada borang. Tarik bucu kanan bawah untuk menukar saiz.`;
      
      downloadSignedPdfBtn.style.display = "inline-flex";
      openSignModalBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> Tukar Tandatangan`;
    });
  }

  function resizeSignatureModalCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const canvasWrapper = sigCanvas.parentElement;
    
    const w = canvasWrapper.clientWidth;
    const h = canvasWrapper.clientHeight;
    
    sigCanvas.width = w * ratio;
    sigCanvas.height = h * ratio;
    sigCanvas.getContext("2d").scale(ratio, ratio);
    
    if (signaturePad) {
      signaturePad.clear();
    }
  }

  // --- Step 4: Drag and Resize Touch Engine (Android/iOS optimized) ---

  let isDragging = false;
  let isResizing = false;
  
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;
  let startWidth = 0, startHeight = 0;

  function createDraggableSignatureOverlay() {
    removeSignatureOverlay();

    if (!signatureData || signaturePosition.pageIndex !== currentPageIndex) return;

    const overlay = document.createElement("div");
    // Start in editing mode on initial placement
    overlay.className = "sig-draggable-overlay editing";
    overlay.id = "sig-overlay";

    overlay.addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.classList.add("editing");
    });
    
    // Combined touchstart listener with passive: false to ensure editing selection and drag start both execute cleanly
    overlay.addEventListener("touchstart", (e) => {
      overlay.classList.add("editing");
      onDragStart(e);
    }, { passive: false });
    
    const img = document.createElement("img");
    img.src = signatureData;
    overlay.appendChild(img);

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "sig-resize-handle";
    overlay.appendChild(resizeHandle);

    const deleteBtn = document.createElement("div");
    deleteBtn.className = "sig-delete-btn";
    deleteBtn.innerHTML = "&times;";
    overlay.appendChild(deleteBtn);

    // Compute pixel coordinates from stored percentages for the current zoom/resolution
    const x = signaturePosition.xPercent * pdfCanvas.width;
    const y = signaturePosition.yPercent * pdfCanvas.height;
    const w = signaturePosition.wPercent * pdfCanvas.width;
    const h = signaturePosition.hPercent * pdfCanvas.height;

    overlay.style.left = `${x}px`;
    overlay.style.top = `${y}px`;
    overlay.style.width = `${w}px`;
    overlay.style.height = `${h}px`;

    pdfWrapper.appendChild(overlay);

    overlay.addEventListener("mousedown", onDragStart);

    resizeHandle.addEventListener("mousedown", onResizeStart);
    resizeHandle.addEventListener("touchstart", onResizeStart, { passive: false });

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      signatureData = null;
      removeSignatureOverlay();
      
      stepInstruction.innerHTML = `Langkah 1: Klik butang <strong>"Tulis Tandatangan"</strong> di bawah untuk melukis tandatangan anda.`;
      downloadSignedPdfBtn.style.display = "none";
      openSignModalBtn.innerHTML = `<i class="fa-solid fa-signature"></i> Tulis Tandatangan`;
    });
  }

  function removeSignatureOverlay() {
    const existing = document.getElementById("sig-overlay");
    if (existing) existing.remove();
  }

  function toggleSignatureOverlayVisibility() {
    if (signatureData && signaturePosition.pageIndex === currentPageIndex) {
      createDraggableSignatureOverlay();
    } else {
      removeSignatureOverlay();
    }
  }

  function onDragStart(e) {
    if (isResizing) return;
    e.preventDefault();
    
    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
    
    const overlay = document.getElementById("sig-overlay");
    if (!overlay) return;

    isDragging = true;
    startX = clientX;
    startY = clientY;
    
    startLeft = parseInt(overlay.style.left) || 0;
    startTop = parseInt(overlay.style.top) || 0;

    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchend", onDragEnd);
  }

  function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

    const overlay = document.getElementById("sig-overlay");
    if (!overlay) return;

    const dx = clientX - startX;
    const dy = clientY - startY;

    let newLeft = startLeft + dx;
    let newTop = startTop + dy;

    const maxLeft = pdfCanvas.width - overlay.offsetWidth;
    const maxTop = pdfCanvas.height - overlay.offsetHeight;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    overlay.style.left = `${newLeft}px`;
    overlay.style.top = `${newTop}px`;

    // Save percentages relative to canvas
    signaturePosition.xPercent = newLeft / pdfCanvas.width;
    signaturePosition.yPercent = newTop / pdfCanvas.height;
  }

  function onDragEnd() {
    isDragging = false;
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchend", onDragEnd);
  }

  function onResizeStart(e) {
    e.stopPropagation();
    e.preventDefault();

    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const overlay = document.getElementById("sig-overlay");
    if (!overlay) return;

    isResizing = true;
    startX = clientX;
    startWidth = parseInt(overlay.style.width) || overlay.offsetWidth;
    startHeight = parseInt(overlay.style.height) || overlay.offsetHeight;

    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("touchmove", onResizeMove, { passive: false });
    document.addEventListener("mouseup", onResizeEnd);
    document.addEventListener("touchend", onResizeEnd);
  }

  function onResizeMove(e) {
    if (!isResizing) return;
    e.preventDefault();

    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const overlay = document.getElementById("sig-overlay");
    if (!overlay) return;

    const dx = clientX - startX;
    let newWidth = startWidth + dx;
    let newHeight = newWidth * 0.5;

    if (newWidth < 50) {
      newWidth = 50;
      newHeight = 25;
    }

    const maxAllowedWidth = pdfCanvas.width - parseInt(overlay.style.left);
    const maxAllowedHeight = pdfCanvas.height - parseInt(overlay.style.top);

    if (newWidth > maxAllowedWidth) {
      newWidth = maxAllowedWidth;
      newHeight = newWidth * 0.5;
    }
    if (newHeight > maxAllowedHeight) {
      newHeight = maxAllowedHeight;
      newWidth = newHeight * 2;
    }

    overlay.style.width = `${newWidth}px`;
    overlay.style.height = `${newHeight}px`;

    // Save percentages relative to canvas
    signaturePosition.wPercent = newWidth / pdfCanvas.width;
    signaturePosition.hPercent = newHeight / pdfCanvas.height;
  }

  function onResizeEnd() {
    isResizing = false;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("touchmove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
    document.removeEventListener("touchend", onResizeEnd);
  }

  // --- Step 5: Save & PDF compiling via PDF-Lib ---

  downloadSignedPdfBtn.addEventListener("click", async () => {
    if (!signatureData) return;

    try {
      downloadSignedPdfBtn.disabled = true;
      downloadSignedPdfBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Membina PDF...`;

      const pages = pdfDoc.getPages();
      const targetPage = pages[signaturePosition.pageIndex];
      
      // Get the bounding box of the page (handles non-zero origins from bank statements, etc.)
      const cropBox = targetPage.getCropBox() || targetPage.getMediaBox();
      const originX = cropBox.x || 0;
      const originY = cropBox.y || 0;
      const pageW = cropBox.width || targetPage.getWidth();
      const pageH = cropBox.height || targetPage.getHeight();

      // Convert percentages directly back to fixed absolute PDF points relative to the cropBox/mediaBox origin
      const pdfX = originX + (signaturePosition.xPercent * pageW);
      const pdfWidth = signaturePosition.wPercent * pageW;
      const pdfHeight = signaturePosition.hPercent * pageH;
      const pdfY = originY + pageH - (signaturePosition.yPercent * pageH) - pdfHeight;

      const signatureEmbeddedImage = await pdfDoc.embedPng(signatureData);

      targetPage.drawImage(signatureEmbeddedImage, {
        x: pdfX,
        y: pdfY,
        width: pdfWidth,
        height: pdfHeight
      });

      const finalizedBytes = await pdfDoc.save();

      // 1. Trigger local download first so they immediately get the file offline
      triggerFileDownload(finalizedBytes, "signsenang-dokumen-signed.pdf");

      // 2. Change button text and upload to cloud for agent link generation
      downloadSignedPdfBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up fa-spin"></i> Menyediakan Pautan Ejen...`;
      
      let signedFileUrl = "";
      try {
        signedFileUrl = await uploadToCloud(finalizedBytes, "signsenang-dokumen-signed.pdf");
      } catch (uploadErr) {
        console.warn("Gagal muat naik ke awan, namun fail lokal telah dimuat turun:", uploadErr);
      }

      // 3. Setup the link sharing elements on the success panel
      const signedLinkContainer = document.getElementById("signed-link-container");
      const signedPdfLink = document.getElementById("signed-pdf-link");
      const copySignedLinkBtn = document.getElementById("copy-signed-link-btn");
      const successInstructionText = document.getElementById("success-instruction-text");

      if (signedFileUrl) {
        if (signedPdfLink) {
          signedPdfLink.href = signedFileUrl;
          signedPdfLink.textContent = signedFileUrl;
        }
        if (signedLinkContainer) {
          signedLinkContainer.style.display = "flex";
        }
        if (successInstructionText) {
          successInstructionText.innerHTML = `<strong>Langkah Seterusnya:</strong> Sila <strong>Salin Pautan (Copy Link)</strong> di atas dan hantar terus kepada ejen Cuckoo anda, atau hantar fail PDF yang dimuat turun tadi melalui WhatsApp. Terima kasih!`;
        }

        // Setup Tactile Copy Button Action
        if (copySignedLinkBtn) {
          copySignedLinkBtn.onclick = (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(signedFileUrl).then(() => {
              copySignedLinkBtn.innerHTML = `<i class="fa-solid fa-check"></i> Disalin!`;
              copySignedLinkBtn.style.background = "#059669";
              setTimeout(() => {
                copySignedLinkBtn.innerHTML = `<i class="fa-solid fa-copy"></i> Copy Link`;
                copySignedLinkBtn.style.background = "";
              }, 2000);
            }).catch(err => {
              console.error("Gagal menyalin link:", err);
              alert("Sila salin pautan ini secara manual:\n" + signedFileUrl);
            });
          };
        }
      } else {
        // If upload failed, hide container
        if (signedLinkContainer) {
          signedLinkContainer.style.display = "none";
        }
      }

      workspacePanel.style.display = "none";
      successPanel.style.display = "block";
      document.body.classList.remove("customer-active");

    } catch (saveError) {
      console.error("PDF generation failure:", saveError);
      alert(`Gagal membina fail PDF: ${saveError.message}`);
      downloadSignedPdfBtn.disabled = false;
      downloadSignedPdfBtn.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> Sahkan & Muat Turun PDF`;
    }
  });

  function triggerFileDownload(bytes, name) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = url;
    downloadAnchor.download = name;
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  }
});
