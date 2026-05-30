/* 
  Cuckoo EasySign - Agent Portal Controller (Advanced Board Fill & Share)
  Orchestrates PDF form filling (Text and Tick drawings), PDF-Lib binary compiling, 
  resilient cloud uploads, QR Codes, and instant Local-Offline signing.
*/

document.addEventListener("DOMContentLoaded", () => {
  // Global States
  let originalPdfBytes = null;
  let filledPdfBytes = null;
  let pdfjsDocInstance = null;
  let currentPageIndex = 0;
  let zoomLevel = 1.0; // Dynamic zoom factor
  let activeTool = null; // Track currently selected active tool (text or tick)
  
  // Annotation Storing Array
  let annotations = []; // { id, type, pageIndex, xPercent, yPercent, wPercent, hPercent, fontSize, value }

  // DOM Elements
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const selectBtn = document.getElementById("select-btn");
  
  const uploadSection = document.getElementById("upload-section");
  const editorSection = document.getElementById("editor-section");
  const editorFileName = document.getElementById("editor-file-name");
  
  const editorPdfWrapper = document.getElementById("editor-pdf-wrapper");
  const editorPdfCanvas = document.getElementById("editor-pdf-canvas");
  const editorPageIndicator = document.getElementById("editor-page-indicator");
  const editorPrevBtn = document.getElementById("editor-prev-btn");
  const editorNextBtn = document.getElementById("editor-next-btn");
  
  // Zoom Elements
  const editorZoomInBtn = document.getElementById("editor-zoom-in-btn");
  const editorZoomOutBtn = document.getElementById("editor-zoom-out-btn");
  const editorZoomVal = document.getElementById("editor-zoom-val");
  
  const addTextBtn = document.getElementById("add-text-btn");
  const addTickBtn = document.getElementById("add-tick-btn");
  const generateFilledPdfBtn = document.getElementById("generate-filled-pdf-btn");
  const editorDownloadPdfBtn = document.getElementById("editor-download-pdf-btn");
  
  // Progress & Share Section
  const progressSection = document.getElementById("progress-section");
  const shareSection = document.getElementById("share-section");
  
  const stepEncrypt = document.getElementById("step-encrypt");
  const stepUpload = document.getElementById("step-upload");
  
  const shareLinkText = document.getElementById("share-link-text");
  const copyLinkBtn = document.getElementById("copy-link-btn");
  const whatsappShareBtn = document.getElementById("whatsapp-share-btn");
  const agentDownloadPdfBtn = document.getElementById("agent-download-pdf-btn");
  const actionSignLocalBtn = document.getElementById("action-sign-local-btn");
  const resetBtn = document.getElementById("reset-btn");

  let activeFileName = "cuckoo_form.pdf";
  let generatedShareLink = "";

  // --- Drag and Drop Handlers ---
  
  selectBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        processFile(file);
      } else {
        alert("Sila pilih fail PDF sahaja.");
      }
    }
  });

  // --- Step 1: Read PDF & Launch Editor Workspace ---

  async function processFile(file) {
    try {
      activeFileName = file.name;
      editorFileName.textContent = activeFileName;
      
      // Read bytes
      originalPdfBytes = await readFileAsArrayBuffer(file);
      
      // Initialize PDF.js
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      const pdfBytesCopy = originalPdfBytes.slice(0);
      pdfjsDocInstance = await pdfjsLib.getDocument({ data: pdfBytesCopy }).promise;
      
      // Display Editor, Hide Upload & Activate Mobile Viewport state
      uploadSection.style.display = "none";
      editorSection.style.display = "block";
      document.body.classList.add("editor-active");
      
      currentPageIndex = 0;
      zoomLevel = 1.0;
      editorZoomVal.textContent = "100%";
      annotations = [];
      
      await initEditorWorkspace();

    } catch (err) {
      console.error("Failed to load PDF:", err);
      alert(`Gagal membuka borang PDF: ${err.message}`);
      resetPortal();
    }
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Gagal membaca fail PDF."));
      reader.readAsArrayBuffer(file);
    });
  }

  // --- Step 2: Editor Rendering & Interaction Setup ---

  async function initEditorWorkspace() {
    // Nav Buttons
    editorPrevBtn.onclick = () => navigateEditorPage(-1);
    editorNextBtn.onclick = () => navigateEditorPage(1);

    // Zoom Buttons
    editorZoomInBtn.onclick = () => adjustZoom(0.2);
    editorZoomOutBtn.onclick = () => adjustZoom(-0.2);

    // Active tool helper
    function setActiveTool(tool) {
      if (activeTool === tool) {
        // Toggle off
        activeTool = null;
      } else {
        activeTool = tool;
      }

      // Update button classes
      if (activeTool === "text") {
        addTextBtn.classList.add("active");
        addTickBtn.classList.remove("active");
        showCanvasNotification("Mod Teks Aktif: Ketik pada PDF untuk letak Teks");
      } else if (activeTool === "tick") {
        addTickBtn.classList.add("active");
        addTextBtn.classList.remove("active");
        showCanvasNotification("Mod Tick Aktif: Ketik pada PDF untuk letak Tick");
      } else {
        addTextBtn.classList.remove("active");
        addTickBtn.classList.remove("active");
        hideCanvasNotification();
      }
    }

    // Add Text click - Toggles Text placement mode
    addTextBtn.onclick = (e) => {
      e.stopPropagation();
      setActiveTool("text");
    };

    // Add Tick click - Toggles Tick placement mode
    addTickBtn.onclick = (e) => {
      e.stopPropagation();
      setActiveTool("tick");
    };

    // PDF Canvas Click Listener for Tap-to-Place coordinates
    editorPdfCanvas.addEventListener("click", (e) => {
      if (!activeTool) return;
      e.stopPropagation();

      const rect = editorPdfCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (activeTool === "text") {
        createTextAnnotation(clickX, clickY);
      } else if (activeTool === "tick") {
        createTickAnnotation(clickX, clickY);
      }

      // Automatically reset tool after placing to allow instant editing of the placed node
      setActiveTool(null);
    });

    // Floating notifications over the canvas workspace
    function showCanvasNotification(text) {
      hideCanvasNotification();
      const notification = document.createElement("div");
      notification.className = "canvas-notification";
      notification.id = "canvas-active-tool-notification";
      notification.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${text}</span>`;
      editorPdfWrapper.appendChild(notification);
    }

    function hideCanvasNotification() {
      const existing = document.getElementById("canvas-active-tool-notification");
      if (existing) {
        existing.remove();
      }
    }

    // Document click listener to close editing state safely when clicking blank areas
    document.addEventListener("mousedown", (e) => {
      const target = e.target;
      if (target && typeof target.closest === "function") {
        if (!target.closest(".editor-active-overlay")) {
          blurAllActiveOverlays();
        }
      }
    });
    document.addEventListener("touchstart", (e) => {
      const target = e.target;
      if (target && typeof target.closest === "function") {
        if (!target.closest(".editor-active-overlay")) {
          blurAllActiveOverlays();
        }
      }
    });

    await renderEditorPage(currentPageIndex);
  }

  function blurAllActiveOverlays() {
    document.querySelectorAll(".editor-active-overlay").forEach(overlay => {
      overlay.classList.remove("editing");
    });
  }

  function adjustZoom(amount) {
    const nextZoom = zoomLevel + amount;
    // Clamp zoom between 0.6x and 2.0x
    if (nextZoom >= 0.6 && nextZoom <= 2.0) {
      zoomLevel = Math.round(nextZoom * 10) / 10;
      editorZoomVal.textContent = `${Math.round(zoomLevel * 100)}%`;
      renderEditorPage(currentPageIndex);
    }
  }

  async function renderEditorPage(index) {
    if (!pdfjsDocInstance) return;

    // Save existing overlays in dynamic memory array
    saveActivePageOverlayCoordinates();

    // Clear active overlay widgets on screen
    clearEditorOverlays();

    // Fetch page
    const page = await pdfjsDocInstance.getPage(index + 1);
    
    // Fit canvas width nicely in editor wrapper, scaled by zoomLevel from constrained container
    // On mobile screens <= 1024px, force containerWidth to window.innerWidth to completely bypass any clientWidth flexbox bugs!
    const isMobile = window.innerWidth <= 1024;
    const containerWidth = isMobile ? (window.innerWidth - 20) : ((document.querySelector("#editor-section .pdf-viewer-container")?.clientWidth || 750) - 30);
    const originalViewport = page.getViewport({ scale: 1.0 });
    
    const baseScale = containerWidth / originalViewport.width;
    const finalScale = baseScale * zoomLevel;
    const viewport = page.getViewport({ scale: finalScale });

    // Set wrapper dimensions to align overlays correctly
    editorPdfWrapper.style.width = `${viewport.width}px`;
    editorPdfWrapper.style.height = `${viewport.height}px`;

    editorPdfCanvas.width = viewport.width;
    editorPdfCanvas.height = viewport.height;
    const context = editorPdfCanvas.getContext("2d");

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    // Update indicator
    editorPageIndicator.textContent = `Halaman ${index + 1} / ${pdfjsDocInstance.numPages}`;

    // Reload stored annotations belonging to this page
    loadStoredPageAnnotations(index);
  }

  async function navigateEditorPage(direction) {
    const nextIndex = currentPageIndex + direction;
    if (nextIndex >= 0 && nextIndex < pdfjsDocInstance.numPages) {
      currentPageIndex = nextIndex;
      await renderEditorPage(currentPageIndex);
    }
  }

  // --- Storing / Retrieving Overlays Logic ---

  function saveActivePageOverlayCoordinates() {
    const overlays = editorPdfWrapper.querySelectorAll(".editor-active-overlay");
    overlays.forEach(overlay => {
      const id = overlay.dataset.id;
      const type = overlay.dataset.type;
      
      const x = parseInt(overlay.style.left) || 0;
      const y = parseInt(overlay.style.top) || 0;
      const w = parseInt(overlay.style.width) || overlay.offsetWidth;
      const h = parseInt(overlay.style.height) || overlay.offsetHeight;

      let value = "";
      let fontSize = 12;
      if (type === "text") {
        const input = overlay.querySelector("input");
        value = input ? input.value : "";
        fontSize = parseInt(overlay.dataset.fontSize) || 12;
      } else {
        value = overlay.dataset.value || "✓";
        fontSize = parseInt(overlay.dataset.fontSize) || 10;
      }

      // Convert pixel values to percentage based on the current canvas dimensions
      const xPercent = x / editorPdfCanvas.width;
      const yPercent = y / editorPdfCanvas.height;
      const wPercent = w / editorPdfCanvas.width;
      const hPercent = h / editorPdfCanvas.height;

      // Update in annotations array
      const ann = annotations.find(a => a.id === id);
      if (ann) {
        ann.xPercent = xPercent;
        ann.yPercent = yPercent;
        ann.wPercent = wPercent;
        ann.hPercent = hPercent;
        ann.value = value;
        ann.fontSize = fontSize;
      }
    });
  }

  function clearEditorOverlays() {
    const overlays = editorPdfWrapper.querySelectorAll(".editor-active-overlay");
    overlays.forEach(o => o.remove());
  }

  function loadStoredPageAnnotations(index) {
    const pageAnns = annotations.filter(a => a.pageIndex === index);
    pageAnns.forEach(ann => {
      // Re-calculate pixels from percentages for the current canvas size
      const x = ann.xPercent * editorPdfCanvas.width;
      const y = ann.yPercent * editorPdfCanvas.height;
      const w = ann.wPercent * editorPdfCanvas.width;
      const h = ann.hPercent * editorPdfCanvas.height;

      const annWithPixels = { ...ann, x, y, width: w, height: h };

      if (ann.type === "text") {
        renderTextOverlayDOM(annWithPixels);
      } else if (ann.type === "tick") {
        renderTickOverlayDOM(annWithPixels);
      }
    });
  }

  // --- Step 3: Text & Tick Overlay Generator Handlers ---

  function createTextAnnotation(x = null, y = null) {
    const id = "ann_" + Date.now() + "_" + Math.floor(Math.random()*1000);
    const w = 220;
    const h = 32;

    const targetX = (x !== null) ? (x - 110) : ((editorPdfCanvas.width / 2) - 110);
    const targetY = (y !== null) ? (y - 16) : ((editorPdfCanvas.height / 2) - 16);

    const clampedX = Math.max(0, Math.min(targetX, editorPdfCanvas.width - w));
    const clampedY = Math.max(0, Math.min(targetY, editorPdfCanvas.height - h));

    const ann = {
      id: id,
      type: "text",
      pageIndex: currentPageIndex,
      xPercent: clampedX / editorPdfCanvas.width,
      yPercent: clampedY / editorPdfCanvas.height,
      wPercent: w / editorPdfCanvas.width,
      hPercent: h / editorPdfCanvas.height,
      fontSize: 12, // Default size 12px as requested
      value: ""
    };
    
    annotations.push(ann);
    renderTextOverlayDOM({ ...ann, x: clampedX, y: clampedY, width: w, height: h });
  }

  function renderTextOverlayDOM(ann) {
    const overlay = document.createElement("div");
    // Starts in editing focus mode
    overlay.className = "text-draggable-overlay editor-active-overlay editing";
    overlay.id = ann.id;
    overlay.dataset.id = ann.id;
    overlay.dataset.type = "text";
    overlay.dataset.fontSize = ann.fontSize || 12;

    // Setup coordinates
    overlay.style.left = `${ann.x}px`;
    overlay.style.top = `${ann.y}px`;
    overlay.style.width = `${ann.width}px`;
    overlay.style.height = `${ann.height}px`;

    // Input element
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Taip teks...";
    input.value = ann.value;
    input.style.fontSize = `${ann.fontSize || 12}px`;
    overlay.appendChild(input);

    // Font size controls
    const sizeWidget = document.createElement("div");
    sizeWidget.className = "font-size-widget";
    
    const btnMinus = document.createElement("button");
    btnMinus.innerText = "-";
    
    const sizeLabel = document.createElement("span");
    sizeLabel.innerText = `${ann.fontSize || 12}px`;
    
    const btnPlus = document.createElement("button");
    btnPlus.innerText = "+";
    
    sizeWidget.appendChild(btnMinus);
    sizeWidget.appendChild(sizeLabel);
    sizeWidget.appendChild(btnPlus);
    overlay.appendChild(sizeWidget);

    // Delete cross
    const deleteBtn = document.createElement("div");
    deleteBtn.className = "sig-delete-btn";
    deleteBtn.innerHTML = "&times;";
    overlay.appendChild(deleteBtn);

    // Copy button next to the delete button (on top-left)
    const copyBtn = document.createElement("div");
    copyBtn.className = "sig-copy-btn";
    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyBtn.title = "Salin Teks";
    overlay.appendChild(copyBtn);

    // Drag handle (on bottom-left)
    const dragHandle = document.createElement("div");
    dragHandle.className = "sig-drag-handle";
    dragHandle.innerHTML = '<i class="fa-solid fa-up-down-left-right"></i>';
    dragHandle.title = "Gerakkan";
    overlay.appendChild(dragHandle);

    editorPdfWrapper.appendChild(overlay);

    setupDraggableEvents(overlay, ann);
    setupFocusEvents(overlay, input);

    btnMinus.onclick = (e) => {
      e.stopPropagation();
      let size = parseInt(overlay.dataset.fontSize) || 12;
      if (size > 8) {
        size -= 2;
        overlay.dataset.fontSize = size;
        sizeLabel.innerText = `${size}px`;
        input.style.fontSize = `${size}px`;
        ann.fontSize = size;
      }
    };

    btnPlus.onclick = (e) => {
      e.stopPropagation();
      let size = parseInt(overlay.dataset.fontSize) || 12;
      if (size < 36) {
        size += 2;
        overlay.dataset.fontSize = size;
        sizeLabel.innerText = `${size}px`;
        input.style.fontSize = `${size}px`;
        ann.fontSize = size;
      }
    };

    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      annotations = annotations.filter(a => a.id !== ann.id);
      overlay.remove();
    };

    copyBtn.onclick = (e) => {
      e.stopPropagation();
      saveActivePageOverlayCoordinates();
      
      const newId = "ann_" + Date.now() + "_" + Math.floor(Math.random()*1000);
      const offset = 0.03; // slightly offset from original
      
      const cloned = {
        id: newId,
        type: "text",
        pageIndex: ann.pageIndex,
        xPercent: Math.min(0.95, ann.xPercent + offset),
        yPercent: Math.min(0.95, ann.yPercent + offset),
        wPercent: ann.wPercent,
        hPercent: ann.hPercent,
        fontSize: ann.fontSize || 12,
        value: input.value || ""
      };
      
      annotations.push(cloned);
      
      // Render it on the canvas if we're on the same page
      if (cloned.pageIndex === currentPageIndex) {
        const x = cloned.xPercent * editorPdfCanvas.width;
        const y = cloned.yPercent * editorPdfCanvas.height;
        const w = cloned.wPercent * editorPdfCanvas.width;
        const h = cloned.hPercent * editorPdfCanvas.height;
        
        renderTextOverlayDOM({ ...cloned, x, y, width: w, height: h });
      }
    };

    // Auto-focus the input box
    setTimeout(() => input.focus(), 50);
  }

  // Dynamic Tick Checkmark annotation
  function createTickAnnotation(x = null, y = null) {
    const id = "ann_" + Date.now() + "_" + Math.floor(Math.random()*1000);
    const w = 55;
    const h = 26;

    const targetX = (x !== null) ? (x - 27.5) : ((editorPdfCanvas.width / 2) - 27.5);
    const targetY = (y !== null) ? (y - 13) : ((editorPdfCanvas.height / 2) - 13);

    const clampedX = Math.max(0, Math.min(targetX, editorPdfCanvas.width - w));
    const clampedY = Math.max(0, Math.min(targetY, editorPdfCanvas.height - h));

    const ann = {
      id: id,
      type: "tick",
      pageIndex: currentPageIndex,
      xPercent: clampedX / editorPdfCanvas.width,
      yPercent: clampedY / editorPdfCanvas.height,
      wPercent: w / editorPdfCanvas.width,
      hPercent: h / editorPdfCanvas.height,
      fontSize: 10, // Default tick size is 10px as requested!
      value: "✓"
    };

    annotations.push(ann);
    renderTickOverlayDOM({ ...ann, x: clampedX, y: clampedY, width: w, height: h });
  }

  function renderTickOverlayDOM(ann) {
    const overlay = document.createElement("div");
    // Starts in editing focus mode
    overlay.className = "tick-draggable-overlay editor-active-overlay editing";
    overlay.id = ann.id;
    overlay.dataset.id = ann.id;
    overlay.dataset.type = "tick";
    overlay.dataset.value = ann.value || "✓";
    overlay.dataset.fontSize = ann.fontSize || 10;

    // Setup coordinates
    overlay.style.left = `${ann.x}px`;
    overlay.style.top = `${ann.y}px`;
    overlay.style.width = `${ann.width}px`;
    overlay.style.height = `${ann.height}px`;

    // Symbol element (thick black ✓)
    const span = document.createElement("span");
    span.className = "tick-symbol-span";
    span.innerText = ann.value || "✓";
    span.style.fontSize = `${ann.fontSize || 10}px`;
    overlay.appendChild(span);

    // Font size controls
    const sizeWidget = document.createElement("div");
    sizeWidget.className = "font-size-widget";
    
    const btnMinus = document.createElement("button");
    btnMinus.innerText = "-";
    
    const sizeLabel = document.createElement("span");
    sizeLabel.innerText = `${ann.fontSize || 10}px`;
    
    const btnPlus = document.createElement("button");
    btnPlus.innerText = "+";
    
    sizeWidget.appendChild(btnMinus);
    sizeWidget.appendChild(sizeLabel);
    sizeWidget.appendChild(btnPlus);
    overlay.appendChild(sizeWidget);

    // Delete cross
    const deleteBtn = document.createElement("div");
    deleteBtn.className = "sig-delete-btn";
    deleteBtn.innerHTML = "&times;";
    overlay.appendChild(deleteBtn);

    // Copy button next to the delete button (on top-left)
    const copyBtn = document.createElement("div");
    copyBtn.className = "sig-copy-btn";
    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyBtn.title = "Salin Tick";
    overlay.appendChild(copyBtn);

    // Drag handle (on bottom-left)
    const dragHandle = document.createElement("div");
    dragHandle.className = "sig-drag-handle";
    dragHandle.innerHTML = '<i class="fa-solid fa-up-down-left-right"></i>';
    dragHandle.title = "Gerakkan";
    overlay.appendChild(dragHandle);

    editorPdfWrapper.appendChild(overlay);

    setupDraggableEvents(overlay, ann);
    setupFocusEvents(overlay);

    btnMinus.onclick = (e) => {
      e.stopPropagation();
      let size = parseInt(overlay.dataset.fontSize) || 10;
      if (size > 6) {
        size -= 2;
        overlay.dataset.fontSize = size;
        sizeLabel.innerText = `${size}px`;
        span.style.fontSize = `${size}px`;
        ann.fontSize = size;
      }
    };

    btnPlus.onclick = (e) => {
      e.stopPropagation();
      let size = parseInt(overlay.dataset.fontSize) || 10;
      if (size < 40) {
        size += 2;
        overlay.dataset.fontSize = size;
        sizeLabel.innerText = `${size}px`;
        span.style.fontSize = `${size}px`;
        ann.fontSize = size;
      }
    };

    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      annotations = annotations.filter(a => a.id !== ann.id);
      overlay.remove();
    };

    copyBtn.onclick = (e) => {
      e.stopPropagation();
      saveActivePageOverlayCoordinates();
      
      const newId = "ann_" + Date.now() + "_" + Math.floor(Math.random()*1000);
      const offset = 0.03; // slightly offset from the original tick so it doesn't cover it completely
      
      const cloned = {
        id: newId,
        type: "tick",
        pageIndex: ann.pageIndex,
        xPercent: Math.min(0.95, ann.xPercent + offset),
        yPercent: Math.min(0.95, ann.yPercent + offset),
        wPercent: ann.wPercent,
        hPercent: ann.hPercent,
        fontSize: ann.fontSize || 10,
        value: ann.value || "✓"
      };
      
      annotations.push(cloned);
      
      // Render it on the canvas if we're on the same page
      if (cloned.pageIndex === currentPageIndex) {
        const x = cloned.xPercent * editorPdfCanvas.width;
        const y = cloned.yPercent * editorPdfCanvas.height;
        const w = cloned.wPercent * editorPdfCanvas.width;
        const h = cloned.hPercent * editorPdfCanvas.height;
        
        renderTickOverlayDOM({ ...cloned, x, y, width: w, height: h });
      }
    };
  }

  // --- Dynamic Mouse/Touch Drag & Active-Focus Toggling Handlers ---

  let isDragging = false;
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;
  let activeOverlay = null;
  let activeAnn = null;

  function setupDraggableEvents(overlay, ann) {
    const handle = overlay.querySelector(".sig-drag-handle");
    
    // Bind to orange drag handle specifically (excellent for mobile)
    if (handle) {
      handle.addEventListener("mousedown", onDragStart);
      handle.addEventListener("touchstart", onDragStart, { passive: false });
    }

    // Keep binding to blank parts of the overlay for desktop
    overlay.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON" || e.target.closest(".font-size-widget") || e.target.closest(".sig-drag-handle") || e.target.closest(".sig-delete-btn") || e.target.closest(".sig-copy-btn")) return;
      onDragStart(e);
    });

    overlay.addEventListener("touchstart", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON" || e.target.closest(".font-size-widget") || e.target.closest(".sig-drag-handle") || e.target.closest(".sig-delete-btn") || e.target.closest(".sig-copy-btn")) return;
      onDragStart(e);
    }, { passive: false });

    function onDragStart(e) {
      // Prevent focus bubbling on inputs when dragging via the handle
      if (e.currentTarget === handle) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

      isDragging = true;
      startX = clientX;
      startY = clientY;
      
      startLeft = parseInt(overlay.style.left) || 0;
      startTop = parseInt(overlay.style.top) || 0;
      
      activeOverlay = overlay;
      activeAnn = ann;

      document.addEventListener("mousemove", onDragMove);
      document.addEventListener("touchmove", onDragMove, { passive: false });
      document.addEventListener("mouseup", onDragEnd);
      document.addEventListener("touchend", onDragEnd);
    }
  }

  function onDragMove(e) {
    if (!isDragging || !activeOverlay) return;
    e.preventDefault();

    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    let newLeft = startLeft + dx;
    let newTop = startTop + dy;

    // Boundaries
    const maxLeft = editorPdfCanvas.width - activeOverlay.offsetWidth;
    const maxTop = editorPdfCanvas.height - activeOverlay.offsetHeight;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    activeOverlay.style.left = `${newLeft}px`;
    activeOverlay.style.top = `${newTop}px`;
    
    if (activeAnn) {
      activeAnn.xPercent = newLeft / editorPdfCanvas.width;
      activeAnn.yPercent = newTop / editorPdfCanvas.height;
    }
  }

  function onDragEnd() {
    isDragging = false;
    activeOverlay = null;
    activeAnn = null;
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchend", onDragEnd);
  }

  // Focus-editing click triggers
  function setupFocusEvents(overlay, inputElement = null) {
    overlay.addEventListener("mousedown", (e) => {
      // Blur others, focus this one
      blurAllActiveOverlays();
      overlay.classList.add("editing");
      
      if (inputElement) {
        inputElement.focus();
      }
    });

    overlay.addEventListener("touchstart", (e) => {
      blurAllActiveOverlays();
      overlay.classList.add("editing");
      
      if (inputElement) {
        inputElement.focus();
      }
    });
  }

  // --- Step 4: PDF Compilation with Annotation Overlay Merging ---

  async function compilePdfWithAnnotations() {
    if (!originalPdfBytes) throw new Error("Tiada fail PDF yang dimuat naik.");
    
    saveActivePageOverlayCoordinates();

    const pdfBytesForPDFLib = originalPdfBytes.slice(0);
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytesForPDFLib);
    const pages = pdfDoc.getPages();

    const standardFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    // Calculate dynamic scaling from editor canvas pixels to PDF points
    const canvasWidth = (editorPdfCanvas && editorPdfCanvas.width) ? editorPdfCanvas.width : 600;

    for (const ann of annotations) {
      const page = pages[ann.pageIndex];
      if (!page) continue;
      
      const cropBox = page.getCropBox() || page.getMediaBox();
      const originX = cropBox.x || 0;
      const originY = cropBox.y || 0;
      const pageW = cropBox.width || page.getWidth();
      const pageH = cropBox.height || page.getHeight();
      
      const scaleFactor = pageW / canvasWidth;

      // Position of the overlay box relative to page width and height, accounting for non-zero origin
      const pdfX = originX + (ann.xPercent * pageW);
      const boxTop = originY + pageH - (ann.yPercent * pageH);

      if (ann.type === "text") {
        // Height of the text overlay in DOM
        const overlayHeight = (ann.hPercent || 0) * pageH;
        const textFontSizePoints = (ann.fontSize || 12) * scaleFactor;
        
        // Center text vertically inside the outer box (taking font baseline into account)
        const boxCenterY = boxTop - overlayHeight / 2;
        const pdfY = boxCenterY - textFontSizePoints * 0.35;

        page.drawText(ann.value || "", {
          x: pdfX,
          y: pdfY,
          size: textFontSizePoints,
          font: standardFont,
          color: PDFLib.rgb(0, 0, 0)
        });

      } else if (ann.type === "tick") {
        // Height of the tick overlay in DOM
        const overlayHeight = (ann.hPercent || 0) * pageH;
        const size = (ann.fontSize || 10) * scaleFactor;
        const thickness = Math.max(1.5, size * 0.18);
        
        // Center tick vertically inside the outer box
        const boxBottom = boxTop - overlayHeight / 2 - size / 2;
        
        const x1 = pdfX + size * 0.15;
        const y1 = boxBottom + size * 0.45;
        
        const x2 = pdfX + size * 0.42;
        const y2 = boxBottom + size * 0.15;
        
        const x3 = pdfX + size * 0.85;
        const y3 = boxBottom + size * 0.75;

        // Draw left short leg of tick
        page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          thickness: thickness,
          color: PDFLib.rgb(0, 0, 0)
        });

        // Draw right long leg of tick
        page.drawLine({
          start: { x: x2, y: y2 },
          end: { x: x3, y: y3 },
          thickness: thickness,
          color: PDFLib.rgb(0, 0, 0)
        });
      }
    }

    return await pdfDoc.save();
  }

  // Event listener for editor download PDF button
  if (editorDownloadPdfBtn) {
    editorDownloadPdfBtn.addEventListener("click", async () => {
      try {
        editorDownloadPdfBtn.disabled = true;
        const originalHtml = editorDownloadPdfBtn.innerHTML;
        editorDownloadPdfBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyediakan PDF...`;
        
        const compiledBytes = await compilePdfWithAnnotations();
        triggerFileDownload(compiledBytes, `edited_${activeFileName}`);
        
        editorDownloadPdfBtn.disabled = false;
        editorDownloadPdfBtn.innerHTML = originalHtml;
      } catch (err) {
        console.error("Gagal melengkapkan borang PDF:", err);
        alert(`Gagal melengkapkan borang PDF: ${err.message}`);
        editorDownloadPdfBtn.disabled = false;
        editorDownloadPdfBtn.innerHTML = `<i class="fa-solid fa-download"></i> Muat Turun PDF (Lokal)`;
      }
    });
  }

  generateFilledPdfBtn.addEventListener("click", async () => {
    try {
      editorSection.style.display = "none";
      progressSection.style.display = "block";

      updateStepStatus(stepEncrypt, "active");
      updateStepStatus(stepUpload, "idle");

      // --- STEP 1: Burn Text & Ticks into PDF-Lib ---
      console.log("Compiling agent annotations into PDF buffer...");
      
      filledPdfBytes = await compilePdfWithAnnotations();
      updateStepStatus(stepEncrypt, "completed");
      updateStepStatus(stepUpload, "active");

      // --- STEP 2: Cloud Package Upload ---
      console.log("Uploading filled PDF to cloud nodes...");
      const downloadUrl = await uploadToCloud(filledPdfBytes, activeFileName);
      updateStepStatus(stepUpload, "completed");

      // --- STEP 3: Display Share Dashboard ---
      const baseSignUrl = getBaseSignerUrl();
      generatedShareLink = `${baseSignUrl}?file=${encodeURIComponent(downloadUrl)}`;

      setTimeout(() => {
        progressSection.style.display = "none";
        shareSection.style.display = "block";
        displayShareDashboard(generatedShareLink);
      }, 600);

    } catch (err) {
      console.error("PDF Compiling failed:", err);
      alert(`Gagal melengkapkan borang PDF: ${err.message}`);
      resetPortal();
    }
  });

  // --- Step 5: Sharing Panel Agent Downloads & Local Offline Signings ---

  agentDownloadPdfBtn.addEventListener("click", () => {
    if (!filledPdfBytes) return;
    triggerFileDownload(filledPdfBytes, `filled_${activeFileName}`);
  });

  actionSignLocalBtn.addEventListener("click", () => {
    if (!filledPdfBytes) return;

    try {
      actionSignLocalBtn.disabled = true;
      actionSignLocalBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Membuka mod tandatangan terus...`;

      // Convert buffer to base64
      const base64 = arrayBufferToBase64(filledPdfBytes);
      sessionStorage.setItem("localPdfBytes", base64);
      sessionStorage.setItem("localPdfName", activeFileName);

      // Redirect
      window.location.href = "sign.html?mode=local";

    } catch (error) {
      console.error("Local sign error:", error);
      alert(`Gagal membuka mod tandatangan terus: ${error.message}`);
      actionSignLocalBtn.disabled = false;
      actionSignLocalBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> Tandatangan Terus Di Sini (Offline)`;
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

  function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function getBaseSignerUrl() {
    const loc = window.location;
    let path = loc.pathname;
    if (path.endsWith("index.html")) {
      path = path.replace("index.html", "sign.html");
    } else if (path.endsWith("/")) {
      path += "sign.html";
    } else {
      path += "/sign.html";
    }
    return `${loc.protocol}//${loc.host}${path}`;
  }

  function displayShareDashboard(shareLink) {
    shareLinkText.textContent = shareLink;
    shareLinkText.href = shareLink;

    try {
      new QRious({
        element: document.getElementById("qr-canvas"),
        value: shareLink,
        size: 130,
        background: "white",
        foreground: "#dc2626", // Cuckoo brand red for QR
        level: "M"
      });
    } catch (qrError) {
      console.error("QR Code rendering failed:", qrError);
    }

    const textMsg = `Salam sejahtera! Sila klik link di bawah untuk menandatangani dokumen pendaftaran Cuckoo anda secara digital. \n\nSemua maklumat pendaftaran Nama, IC, dan Pilihan Produk telah kami lengkapkan. Anda hanya perlu sign terus pada handphone sahaja: \n\n👉 ${shareLink}`;
    whatsappShareBtn.onclick = () => {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
      window.open(waUrl, "_blank");
    };
  }

  // --- Copy, Reset & Utility Handlers ---

  copyLinkBtn.addEventListener("click", () => {
    if (!generatedShareLink) return;
    
    navigator.clipboard.writeText(generatedShareLink)
      .then(() => {
        const originalContent = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied & Opened!`;
        copyLinkBtn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        
        // Open the generated link in a new tab instantly!
        window.open(generatedShareLink, "_blank");
        
        setTimeout(() => {
          copyLinkBtn.innerHTML = originalContent;
          copyLinkBtn.style.background = "";
        }, 2000);
      })
      .catch((err) => {
        console.error("Clipboard copy failure:", err);
        // Fallback open even if clipboard copy fails
        window.open(generatedShareLink, "_blank");
      });
  });

  resetBtn.addEventListener("click", () => {
    resetPortal();
  });

  function resetPortal() {
    fileInput.value = "";
    originalPdfBytes = null;
    filledPdfBytes = null;
    pdfjsDocInstance = null;
    currentPageIndex = 0;
    zoomLevel = 1.0;
    annotations = [];
    generatedShareLink = "";
    activeTool = null;
    if (addTextBtn) addTextBtn.classList.remove("active");
    if (addTickBtn) addTickBtn.classList.remove("active");
    
    const notification = document.getElementById("canvas-active-tool-notification");
    if (notification) {
      notification.remove();
    }

    clearEditorOverlays();
    
     shareSection.style.display = "none";
    progressSection.style.display = "none";
    editorSection.style.display = "none";
    
    // Deactivate Mobile Viewport state
    document.body.classList.remove("editor-active");
    
    uploadSection.style.display = "block";
    dropzone.style.display = "block";
    
    actionSignLocalBtn.disabled = false;
    actionSignLocalBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> Tandatangan Terus Di Sini (Offline)`;
  }

  function updateStepStatus(element, status) {
    if (!element) return;
    element.className = `progress-item ${status}`;
  }
});
