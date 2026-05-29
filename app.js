// Config Core Engine Variables and References mapping
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Application State Management
const state = {
  'mod-crop-split': { files: [], activeIdx: -1, outputs: [] },
  'mod-converter': { files: [], activeIdx: -1, outputs: [] },
  'mod-compressor': { files: [], activeIdx: -1, outputs: [] },
  'mod-upscaler': { files: [], activeIdx: -1, outputs: [] },
  'mod-resizer': { files: [], activeIdx: -1, outputs: [] },
  'mod-pdf': { files: [], activeIdx: -1, pdfDocs: [], outputs: [] },
  'mod-svg': { files: [], activeIdx: -1, outputs: [] },
  'mod-bg-remover': { files: [], activeIdx: -1, outputs: [], bgImgObject: null }
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Sidebar Routing
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const viewTitle = document.getElementById('view-title');
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menu-toggle');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
      
      viewTitle.childNodes[0].textContent = item.textContent.trim();
      
      if (sidebar) {
        sidebar.classList.remove('open');
      }
      
      // Update specific layouts on tab switch
      if (targetId === 'mod-crop-split') {
        setTimeout(updateCropOverlayLayout, 100);
      }
    });
  });

  // Global Reset Button
  const globalResetBtn = document.getElementById('global-reset-btn');
  if (globalResetBtn) {
    globalResetBtn.addEventListener('click', () => {
      Object.keys(state).forEach(moduleId => {
        clearModuleFiles(moduleId);
        resetModuleSettings(moduleId);
      });
      alert('OmniMedia Studio: Global Reset Complete');
    });
  }

  // Helper Utility: Bytes formatter
  function formatBytesToKB(bytes) { 
    return (bytes / 1024).toFixed(1) + ' KB'; 
  }

  // Core Drag-and-Drop + Stop Propagation Handler
  function setupDragAndDropEngine(dropZoneId, fileInputId, processCallback) {
    const zone = document.getElementById(dropZoneId);
    const input = document.getElementById(fileInputId);
    if (!zone || !input) return;
    
    zone.addEventListener('click', () => {
      input.click();
    });
    
    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    zone.addEventListener('dragover', (e) => {
      e.preventDefault(); 
      zone.classList.add('dragover'); 
    });
    
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });
    
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) { 
        input.files = e.dataTransfer.files; 
        processCallback(e.dataTransfer.files); 
      }
    });
    
    input.addEventListener('change', (e) => { 
      if (e.target.files.length) {
        processCallback(e.target.files); 
      }
    });
  }

  // State Management Actions
  function addFilesToModuleState(moduleId, rawFiles) {
    const moduleState = state[moduleId];
    if (!moduleState) return;
    
    Array.from(rawFiles).forEach(file => {
      const fileObj = {
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        previewUrl: ''
      };
      
      if (file.type.startsWith('image/')) {
        fileObj.previewUrl = URL.createObjectURL(file);
      }
      moduleState.files.push(fileObj);
    });
    
    if (moduleState.activeIdx === -1 && moduleState.files.length > 0) {
      moduleState.activeIdx = 0;
    }
    
    updateModuleFileQueueUI(moduleId);
    
    if (moduleState.activeIdx !== -1) {
      triggerActiveFilePreview(moduleId, moduleState.files[moduleState.activeIdx]);
    }
  }

  function removeFileFromModuleState(moduleId, idx) {
    const moduleState = state[moduleId];
    if (!moduleState) return;
    
    const removed = moduleState.files.splice(idx, 1)[0];
    if (removed && removed.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    
    if (moduleState.files.length === 0) {
      moduleState.activeIdx = -1;
    } else if (moduleState.activeIdx >= moduleState.files.length) {
      moduleState.activeIdx = moduleState.files.length - 1;
    }
    
    updateModuleFileQueueUI(moduleId);
    
    if (moduleState.activeIdx !== -1) {
      triggerActiveFilePreview(moduleId, moduleState.files[moduleState.activeIdx]);
    } else {
      clearActiveFilePreview(moduleId);
    }
  }

  function clearModuleFiles(moduleId) {
    const moduleState = state[moduleId];
    if (!moduleState) return;
    
    moduleState.files.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    moduleState.files = [];
    moduleState.activeIdx = -1;
    moduleState.outputs = [];
    
    updateModuleFileQueueUI(moduleId);
    clearActiveFilePreview(moduleId);
    toggleOutputsActionButtons(moduleId, false);
    
    // Clear outputs UI
    const grid = document.querySelector(`#${moduleId} .gallery-grid`);
    if (grid) grid.innerHTML = '';
    
    const tableBody = document.querySelector(`#${moduleId} tbody`);
    if (tableBody) tableBody.innerHTML = '';
  }

  function toggleModuleActionButtons(moduleId, hasFiles) {
    const processBtn = document.getElementById(`${moduleId.replace('mod-', '')}-process-btn`);
    const clearBtn = document.getElementById(`${moduleId.replace('mod-', '')}-clear-btn`);
    
    if (processBtn) processBtn.disabled = !hasFiles;
    if (clearBtn) clearBtn.disabled = !hasFiles;
  }

  function toggleOutputsActionButtons(moduleId, hasOutputs) {
    const downloadBtn = document.getElementById(`${moduleId.replace('mod-', '')}-download-btn`);
    const zipBtn = document.getElementById(`${moduleId.replace('mod-', '')}-zip-btn`);
    
    if (downloadBtn) downloadBtn.disabled = !hasOutputs;
    if (zipBtn) zipBtn.disabled = !hasOutputs;
  }

  // Update Files List DOM
  function updateModuleFileQueueUI(moduleId) {
    if (moduleId === 'mod-pdf') {
      const imgQueueEl = document.getElementById('pdf-img-queue');
      const docQueueEl = document.getElementById('pdf-doc-queue');
      if (imgQueueEl) imgQueueEl.innerHTML = '';
      if (docQueueEl) docQueueEl.innerHTML = '';
      
      const moduleState = state[moduleId];
      if (!moduleState || !moduleState.files.length) {
        toggleModuleActionButtons(moduleId, false);
        return;
      }
      
      toggleModuleActionButtons(moduleId, true);
      
      moduleState.files.forEach((fileObj, idx) => {
        const isPdf = fileObj.name.toLowerCase().endsWith('.pdf');
        const queueEl = isPdf ? docQueueEl : imgQueueEl;
        if (!queueEl) return;
        
        const item = document.createElement('div');
        item.className = 'file-item' + (idx === moduleState.activeIdx ? ' active' : '');
        
        const img = document.createElement('img');
        img.className = 'file-item-thumb';
        if (fileObj.type.startsWith('image/')) {
          img.src = fileObj.previewUrl;
        } else if (isPdf) {
          img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        }
        
        const details = document.createElement('div');
        details.className = 'file-item-details';
        
        const name = document.createElement('div');
        name.className = 'file-item-name';
        name.textContent = fileObj.name;
        
        const meta = document.createElement('div');
        meta.className = 'file-item-meta';
        meta.textContent = formatBytesToKB(fileObj.size);
        
        details.appendChild(name);
        details.appendChild(meta);
        
        const actions = document.createElement('div');
        actions.className = 'file-item-actions';
        
        const badge = document.createElement('span');
        badge.className = `status-badge ${fileObj.status}`;
        badge.textContent = fileObj.status;
        
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-remove-file';
        delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeFileFromModuleState(moduleId, idx);
        });
        
        actions.appendChild(badge);
        actions.appendChild(delBtn);
        
        item.appendChild(img);
        item.appendChild(details);
        item.appendChild(actions);
        
        item.addEventListener('click', () => {
          moduleState.activeIdx = idx;
          updateModuleFileQueueUI(moduleId);
          triggerActiveFilePreview(moduleId, fileObj);
        });
        
        queueEl.appendChild(item);
      });
    } else {
      const queueId = `${moduleId.replace('mod-', '')}-queue`;
      const queueEl = document.getElementById(queueId);
      if (!queueEl) return;
      queueEl.innerHTML = '';
      
      const moduleState = state[moduleId];
      if (!moduleState || !moduleState.files.length) {
        toggleModuleActionButtons(moduleId, false);
        return;
      }
      
      toggleModuleActionButtons(moduleId, true);
      
      moduleState.files.forEach((fileObj, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item' + (idx === moduleState.activeIdx ? ' active' : '');
        
        const img = document.createElement('img');
        img.className = 'file-item-thumb';
        if (fileObj.type.startsWith('image/')) {
          img.src = fileObj.previewUrl;
        } else if (fileObj.name.endsWith('.svg')) {
          img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2306b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';
        }
        
        const details = document.createElement('div');
        details.className = 'file-item-details';
        
        const name = document.createElement('div');
        name.className = 'file-item-name';
        name.textContent = fileObj.name;
        
        const meta = document.createElement('div');
        meta.className = 'file-item-meta';
        meta.textContent = formatBytesToKB(fileObj.size);
        
        details.appendChild(name);
        details.appendChild(meta);
        
        const actions = document.createElement('div');
        actions.className = 'file-item-actions';
        
        const badge = document.createElement('span');
        badge.className = `status-badge ${fileObj.status}`;
        badge.textContent = fileObj.status;
        
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-remove-file';
        delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeFileFromModuleState(moduleId, idx);
        });
        
        actions.appendChild(badge);
        actions.appendChild(delBtn);
        
        item.appendChild(img);
        item.appendChild(details);
        item.appendChild(actions);
        
        item.addEventListener('click', () => {
          moduleState.activeIdx = idx;
          updateModuleFileQueueUI(moduleId);
          triggerActiveFilePreview(moduleId, fileObj);
        });
        
        queueEl.appendChild(item);
      });
    }
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Previews Updates
  let csLoadedImgMemoryBuffer = null;
  let upFileObjectBuffer = null;
  let resizeImageObjectBuffer = null;
  let resizeNativeAspectMemoryBuffer = 1;
  let svgTextStreamMemoryBuffer = "";
  let activePdfDocStreamMemoryBuffer = null;
  let bgFileObjectBuffer = null;

  function triggerActiveFilePreview(moduleId, fileObj) {
    if (moduleId === 'mod-crop-split') {
      const img = new Image();
      img.onload = function() {
        csLoadedImgMemoryBuffer = img;
        csPreviewImg.src = fileObj.previewUrl;
        setTimeout(updateCropOverlayLayout, 100);
      };
      img.src = fileObj.previewUrl;
    } 
    else if (moduleId === 'mod-upscaler') {
      upFileObjectBuffer = fileObj.file;
      upImgBefore.src = fileObj.previewUrl;
      upImgAfter.src = fileObj.previewUrl;
      upSlitDivider.style.left = '50%';
      upOverlayBox.style.width = '50%';
    }
    else if (moduleId === 'mod-resizer') {
      const img = new Image();
      img.onload = function() {
        resizeImageObjectBuffer = img;
        resizeNativeAspectMemoryBuffer = img.width / img.height;
        resWidthInput.value = img.width;
        resHeightInput.value = img.height;
      };
      img.src = fileObj.previewUrl;
    }
    else if (moduleId === 'mod-pdf') {
      if (fileObj.name.endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = function() {
          pdfjsLib.getDocument({ data: this.result }).promise.then(pdf => {
            activePdfDocStreamMemoryBuffer = pdf;
            document.getElementById('pdf-doc-meta').textContent = `PDF: ${pdf.numPages} Pages Found`;
          });
        };
        reader.readAsArrayBuffer(fileObj.file);
      }
    }
    else if (moduleId === 'mod-svg') {
      const reader = new FileReader();
      reader.onload = function(e) {
        svgTextStreamMemoryBuffer = e.target.result;
      };
      reader.readAsText(fileObj.file);
    }
    else if (moduleId === 'mod-bg-remover') {
      bgFileObjectBuffer = fileObj.file;
      bgImgBefore.src = fileObj.previewUrl;
      bgImgAfter.src = fileObj.previewUrl;
      bgSlitDivider.style.left = '50%';
      bgOverlayBox.style.width = '50%';
    }
  }

  function clearActiveFilePreview(moduleId) {
    if (moduleId === 'mod-crop-split') {
      csLoadedImgMemoryBuffer = null;
      csPreviewImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='60'><rect width='100' height='60' fill='%230b0d14'/></svg>";
      csGridOverlay.innerHTML = '';
    }
    else if (moduleId === 'mod-upscaler') {
      upFileObjectBuffer = null;
      upImgBefore.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='60'><rect width='100' height='60' fill='%230b0d14'/></svg>";
      upImgAfter.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='60'><rect width='100' height='60' fill='%230b0d14'/></svg>";
    }
    else if (moduleId === 'mod-resizer') {
      resizeImageObjectBuffer = null;
      resWidthInput.value = '';
      resHeightInput.value = '';
    }
    else if (moduleId === 'mod-pdf') {
      activePdfDocStreamMemoryBuffer = null;
      document.getElementById('pdf-doc-meta').textContent = '';
    }
    else if (moduleId === 'mod-svg') {
      svgTextStreamMemoryBuffer = "";
    }
    else if (moduleId === 'mod-bg-remover') {
      bgFileObjectBuffer = null;
      bgImgBefore.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='60'><rect width='100' height='60' fill='%230b0d14'/></svg>";
      bgImgAfter.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='60'><rect width='100' height='60' fill='%230b0d14'/></svg>";
    }
  }

  // Reset Module Settings Action
  function resetModuleSettings(moduleId) {
    if (moduleId === 'mod-crop-split') {
      csColsInput.value = 3;
      csRowsInput.value = 3;
      csPadSlider.value = 0;
      csQualitySlider.value = 75;
      csQualityVal.textContent = '75%';
      document.getElementById('cs-export-format').value = 'image/webp';
    }
    else if (moduleId === 'mod-converter') {
      document.getElementById('conv-target-format').value = 'image/webp';
      document.getElementById('conv-quality').value = 85;
      document.getElementById('conv-quality-val').textContent = '85%';
    }
    else if (moduleId === 'mod-compressor') {
      compPresetSelect.value = 'custom';
      compQualityWrap.style.display = 'flex';
      compQualitySlider.value = 70;
      document.getElementById('comp-quality-val').textContent = '70%';
    }
    else if (moduleId === 'mod-upscaler') {
      document.getElementById('filter-sharpen').checked = true;
      document.getElementById('filter-clarity').checked = false;
      document.getElementById('filter-color').checked = false;
    }
    else if (moduleId === 'mod-resizer') {
      resLockCheck.checked = true;
      document.getElementById('resize-format').value = 'image/webp';
    }
    else if (moduleId === 'mod-pdf') {
      document.querySelector('input[name="pdf-page-mode"][value="single"]').checked = true;
      document.getElementById('pdf-extract-format').value = 'image/webp';
    }
    else if (moduleId === 'mod-svg') {
      document.getElementById('svg-scale-factor').value = '2';
      document.querySelector('input[name="svg-bg-mode"][value="transparent"]').checked = true;
      document.getElementById('svg-solid-color-wrap').style.display = 'none';
      document.getElementById('svg-bg-color').value = '#FFFFFF';
      document.getElementById('svg-output-format').value = 'image/png';
    }
    else if (moduleId === 'mod-bg-remover') {
      document.getElementById('bg-extract-mode').value = 'transparent';
      document.getElementById('bg-solid-config-group').style.display = 'none';
      document.getElementById('bg-gradient-config-group').style.display = 'none';
      document.getElementById('bg-image-config-group').style.display = 'none';
      document.getElementById('bg-tolerance').value = 18;
      document.getElementById('bg-tolerance-val').textContent = '18%';
      document.getElementById('bg-feather').value = 2;
      document.getElementById('bg-feather-val').textContent = '2px';
      
      document.getElementById('chain-enhance').checked = false;
      document.getElementById('chain-resize').checked = false;
      document.getElementById('chain-resize-group').style.display = 'none';
      document.getElementById('chain-convert').checked = false;
      document.getElementById('chain-convert-group').style.display = 'none';
      
      document.getElementById('bg-export-format').value = 'image/png';
      document.getElementById('bg-export-quality').value = 95;
      document.getElementById('bg-export-quality-val').textContent = '95%';
      
      state['mod-bg-remover'].bgImgObject = null;
      document.getElementById('bg-bgimg-meta').textContent = '';
    }
  }

  // Link Up UI Setup Drivers
  setupDragAndDropEngine('cs-drop-zone', 'cs-file-input', (files) => addFilesToModuleState('mod-crop-split', files));
  setupDragAndDropEngine('conv-drop', 'conv-file-input', (files) => addFilesToModuleState('mod-converter', files));
  setupDragAndDropEngine('comp-drop', 'comp-file-input', (files) => addFilesToModuleState('mod-compressor', files));
  setupDragAndDropEngine('up-drop', 'up-file-input', (files) => addFilesToModuleState('mod-upscaler', files));
  setupDragAndDropEngine('resize-drop', 'resize-file-input', (files) => addFilesToModuleState('mod-resizer', files));
  setupDragAndDropEngine('pdf-img-drop', 'pdf-img-input', (files) => addFilesToModuleState('mod-pdf', files));
  setupDragAndDropEngine('pdf-doc-drop', 'pdf-doc-input', (files) => {
    // Add file and trigger change event
    addFilesToModuleState('mod-pdf', files);
  });
  setupDragAndDropEngine('svg-drop', 'svg-file-input', (files) => addFilesToModuleState('mod-svg', files));
  setupDragAndDropEngine('bg-drop', 'bg-file-input', (files) => addFilesToModuleState('mod-bg-remover', files));

  // Connect module footers reset and clear click handlers
  const modules = ['cs', 'conv', 'comp', 'up', 'resize', 'pdf', 'svg', 'bg'];
  modules.forEach(m => {
    const fullId = m === 'bg' ? 'mod-bg-remover' : (m === 'up' ? 'mod-upscaler' : `mod-${m}`);
    
    document.getElementById(`${m}-reset-btn`).addEventListener('click', () => resetModuleSettings(fullId));
    document.getElementById(`${m}-clear-btn`).addEventListener('click', () => clearModuleFiles(fullId));
  });


  /* ==========================================================================
     MODULE 1: CROP & MATRIX SPLIT
     ========================================================================== */
  const csPreviewImg = document.getElementById('preview-img-split');
  const csGridOverlay = document.getElementById('cs-grid-overlay');
  const csSliceBtn = document.getElementById('cs-process-btn');
  const csOutputGrid = document.getElementById('cs-output-grid');
  const csColsInput = document.getElementById('cs-cols');
  const csRowsInput = document.getElementById('cs-rows');
  const csPadSlider = document.getElementById('cs-padding-adjustment');
  const csQualitySlider = document.getElementById('cs-quality');
  const csQualityVal = document.getElementById('cs-quality-val');

  if (csQualitySlider && csQualityVal) {
    csQualitySlider.addEventListener('input', (e) => csQualityVal.textContent = e.target.value + '%');
  }
  if (csColsInput && csRowsInput) {
    [csColsInput, csRowsInput].forEach(el => el.addEventListener('input', updateCropOverlayLayout));
  }

  window.addEventListener('resize', () => {
    if (csLoadedImgMemoryBuffer) updateCropOverlayLayout();
  });

  function updateCropOverlayLayout() {
    if (!csLoadedImgMemoryBuffer || !csPreviewImg || !csGridOverlay) return;
    const cols = parseInt(csColsInput.value) || 3;
    const rows = parseInt(csRowsInput.value) || 3;
    
    csGridOverlay.style.width = `${csPreviewImg.clientWidth}px`;
    csGridOverlay.style.height = `${csPreviewImg.clientHeight}px`;
    csGridOverlay.style.top = `${csPreviewImg.offsetTop}px`;
    csGridOverlay.style.left = `${csPreviewImg.offsetLeft}px`;
    
    csGridOverlay.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    csGridOverlay.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    csGridOverlay.innerHTML = '';
    
    for (let i = 0; i < cols * rows; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      csGridOverlay.appendChild(cell);
    }
  }

  if (csSliceBtn) {
    csSliceBtn.addEventListener('click', () => {
      const moduleState = state['mod-crop-split'];
      if (!moduleState.files.length || moduleState.activeIdx === -1) return;
      
      const fileObj = moduleState.files[moduleState.activeIdx];
      fileObj.status = 'processing';
      updateModuleFileQueueUI('mod-crop-split');
      
      csOutputGrid.innerHTML = '';
      moduleState.outputs = [];
      
      const cols = parseInt(csColsInput.value) || 3;
      const rows = parseInt(csRowsInput.value) || 3;
      const padAdjust = parseInt(csPadSlider.value);
      const targetFormat = document.getElementById('cs-export-format').value;
      const extMap = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
      const quality = parseFloat(csQualitySlider.value) / 100;
      const cellW = csLoadedImgMemoryBuffer.width / cols;
      const cellH = csLoadedImgMemoryBuffer.height / rows;
      
      let pendingSlices = cols * rows;
      let count = 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let sx = (c * cellW) + padAdjust;
          let sy = (r * cellH) + padAdjust;
          let sw = cellW - (padAdjust * 2);
          let sh = cellH - (padAdjust * 2);
          if (sw <= 0 || sh <= 0) {
            pendingSlices--;
            continue;
          }

          const canvas = document.createElement('canvas');
          canvas.width = 500; 
          canvas.height = 500;
          const ctx = canvas.getContext('2d');
          
          if (targetFormat === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 500, 500);
          }
          
          const scale = Math.min(500 / sw, 500 / sh);
          const dw = sw * scale; 
          const dh = sh * scale;
          const dx = (500 - dw) / 2; 
          const dy = (500 - dh) / 2;
          ctx.drawImage(csLoadedImgMemoryBuffer, sx, sy, sw, sh, dx, dy, dw, dh);

          const currentCount = count;
          canvas.toBlob((blob) => {
            if (!blob) return;
            const sizeString = formatBytesToKB(blob.size);
            const url = URL.createObjectURL(blob);
            const outName = `split_panel_${currentCount}.${extMap[targetFormat]}`;
            moduleState.outputs.push({ blob, url, name: outName });

            const card = document.createElement('div');
            card.className = 'gallery-card';
            
            const imgEl = document.createElement('img'); 
            imgEl.src = url;
            
            const lbl = document.createElement('div'); 
            lbl.className = 'gallery-meta'; 
            lbl.textContent = sizeString;
            
            const saveBtn = document.createElement('a');
            saveBtn.className = 'btn btn-primary';
            saveBtn.innerHTML = '<i data-lucide="download"></i> Save';
            saveBtn.href = url;
            saveBtn.download = outName;
            saveBtn.style.padding = '0.3rem 0.6rem';
            saveBtn.style.fontSize = '0.75rem';
            saveBtn.style.width = 'auto';

            card.appendChild(imgEl); 
            card.appendChild(lbl); 
            card.appendChild(saveBtn);
            csOutputGrid.appendChild(card);
            
            pendingSlices--;
            if (pendingSlices === 0) {
              fileObj.status = 'success';
              updateModuleFileQueueUI('mod-crop-split');
              toggleOutputsActionButtons('mod-crop-split', true);
              if (typeof lucide !== 'undefined') lucide.createIcons();
            }
          }, targetFormat, quality);
          count++;
        }
      }
    });
  }

  // Action Footer Trigger Downloads
  document.getElementById('cs-download-btn').addEventListener('click', () => {
    const outputs = state['mod-crop-split'].outputs;
    if (outputs.length) {
      outputs.forEach(out => {
        const a = document.createElement('a');
        a.href = out.url;
        a.download = out.name;
        a.click();
      });
    }
  });

  document.getElementById('cs-zip-btn').addEventListener('click', async () => {
    const outputs = state['mod-crop-split'].outputs;
    if (!outputs.length) return;
    const zip = new JSZip();
    outputs.forEach(out => zip.file(out.name, out.blob));
    const content = await zip.generateAsync({ type: "blob" });
    const u = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = u;
    a.download = "split_images_bundle.zip";
    a.click();
  });


  /* ==========================================================================
     MODULE 2: BATCH IMAGE CONVERTER
     ========================================================================== */
  const convProcessBtn = document.getElementById('conv-process-btn');
  const convOutputGrid = document.getElementById('conv-output-grid');

  if (document.getElementById('conv-quality')) {
    document.getElementById('conv-quality').addEventListener('input', (e) => {
      document.getElementById('conv-quality-val').textContent = e.target.value + '%';
    });
  }

  if (convProcessBtn) {
    convProcessBtn.addEventListener('click', async () => {
      const moduleState = state['mod-converter'];
      if (!moduleState.files.length) return;
      
      convOutputGrid.innerHTML = '';
      moduleState.outputs = [];
      
      const targetFormat = document.getElementById('conv-target-format').value;
      const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
      const quality = parseFloat(document.getElementById('conv-quality').value) / 100;

      for (let i = 0; i < moduleState.files.length; i++) {
        const fileObj = moduleState.files[i];
        fileObj.status = 'processing';
        updateModuleFileQueueUI('mod-converter');
        
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; 
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (targetFormat === 'image/jpeg') {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
              const outUrl = URL.createObjectURL(blob);
              const outFileName = `${fileObj.name.split('.')[0]}_converted.${extMap[targetFormat]}`;
              moduleState.outputs.push({ blob, url: outUrl, name: outFileName });

              const card = document.createElement('div'); 
              card.className = 'gallery-card';
              
              const outImg = document.createElement('img'); 
              outImg.src = outUrl;
              
              const meta = document.createElement('div'); 
              meta.className = 'gallery-meta'; 
              meta.textContent = formatBytesToKB(blob.size);
              
              const saveBtn = document.createElement('a');
              saveBtn.className = 'btn btn-primary';
              saveBtn.innerHTML = '<i data-lucide="download"></i> Save';
              saveBtn.href = outUrl;
              saveBtn.download = outFileName;
              saveBtn.style.padding = '0.3rem 0.6rem';
              saveBtn.style.fontSize = '0.75rem';
              saveBtn.style.width = 'auto';

              card.appendChild(outImg); 
              card.appendChild(meta); 
              card.appendChild(saveBtn);
              convOutputGrid.appendChild(card);
              
              fileObj.status = 'success';
              updateModuleFileQueueUI('mod-converter');
              resolve();
            }, targetFormat, quality);
          };
          img.src = fileObj.previewUrl;
        });
      }
      
      toggleOutputsActionButtons('mod-converter', true);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }

  document.getElementById('conv-download-btn').addEventListener('click', () => {
    const outputs = state['mod-converter'].outputs;
    if (outputs.length) {
      outputs.forEach(out => {
        const a = document.createElement('a');
        a.href = out.url;
        a.download = out.name;
        a.click();
      });
    }
  });

  document.getElementById('conv-zip-btn').addEventListener('click', async () => {
    const outputs = state['mod-converter'].outputs;
    if (!outputs.length) return;
    const zip = new JSZip();
    outputs.forEach(out => zip.file(out.name, out.blob));
    const content = await zip.generateAsync({ type: "blob" });
    const u = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = u;
    a.download = "converted_images.zip";
    a.click();
  });


  /* ==========================================================================
     MODULE 3: COMPRESSOR
     ========================================================================== */
  const compTableBody = document.getElementById('comp-table-body');
  const compProcessBtn = document.getElementById('comp-process-btn');
  const compPresetSelect = document.getElementById('comp-preset-mode');
  const compQualityWrap = document.getElementById('comp-custom-quality-wrapper');

  if (compPresetSelect && compQualityWrap) {
    compPresetSelect.addEventListener('change', () => {
      compQualityWrap.style.display = (compPresetSelect.value === 'custom') ? 'flex' : 'none';
    });
  }
  if (document.getElementById('comp-quality')) {
    document.getElementById('comp-quality').addEventListener('input', (e) => {
      document.getElementById('comp-quality-val').textContent = e.target.value + '%';
    });
  }

  if (compProcessBtn) {
    compProcessBtn.addEventListener('click', async () => {
      const moduleState = state['mod-compressor'];
      if (!moduleState.files.length) return;
      
      compTableBody.innerHTML = '';
      moduleState.outputs = [];
      
      let q = 0.7;
      const preset = compPresetSelect.value;
      if (preset === 'low') q = 0.9;
      else if (preset === 'medium') q = 0.65;
      else if (preset === 'high') q = 0.35;
      else q = parseFloat(document.getElementById('comp-quality').value) / 100;

      for (let i = 0; i < moduleState.files.length; i++) {
        const fileObj = moduleState.files[i];
        fileObj.status = 'processing';
        updateModuleFileQueueUI('mod-compressor');
        
        await new Promise(resolve => {
          const img = new Image();
          img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; 
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
              const compressedUrl = URL.createObjectURL(blob);
              const outFileName = `${fileObj.name.split('.')[0]}_compressed.webp`;
              moduleState.outputs.push({ blob, url: compressedUrl, name: outFileName });
              
              const savedPct = Math.round(((fileObj.size - blob.size) / fileObj.size) * 100);
              const finalSavedPct = savedPct > 0 ? savedPct : 0;
              
              const row = document.createElement('tr');
              row.innerHTML = `
                <td style="font-weight:600;">${fileObj.name}</td>
                <td>${formatBytesToKB(fileObj.size)}</td>
                <td>${formatBytesToKB(blob.size)}</td>
                <td style="color: ${finalSavedPct > 0 ? 'var(--success)' : 'var(--text-muted)'}; font-weight:bold;">${finalSavedPct}% Saved</td>
                <td>
                  <a class="btn btn-success" href="${compressedUrl}" download="${outFileName}" style="padding:0.3rem 0.6rem; font-size:0.75rem; width:auto;">
                    <i data-lucide="download"></i> Save
                  </a>
                </td>
              `;
              compTableBody.appendChild(row);
              
              fileObj.status = 'success';
              updateModuleFileQueueUI('mod-compressor');
              resolve();
            }, 'image/webp', q);
          };
          img.src = fileObj.previewUrl;
        });
      }
      
      toggleOutputsActionButtons('mod-compressor', true);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }

  document.getElementById('comp-download-btn').addEventListener('click', () => {
    const outputs = state['mod-compressor'].outputs;
    if (outputs.length) {
      outputs.forEach(out => {
        const a = document.createElement('a');
        a.href = out.url;
        a.download = out.name;
        a.click();
      });
    }
  });

  document.getElementById('comp-zip-btn').addEventListener('click', async () => {
    const outputs = state['mod-compressor'].outputs;
    if (!outputs.length) return;
    const zip = new JSZip();
    outputs.forEach(out => zip.file(out.name, out.blob));
    const content = await zip.generateAsync({ type: "blob" });
    const u = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = u;
    a.download = "compressed_images.zip";
    a.click();
  });


  /* ==========================================================================
     MODULE 4: FILTERS & BILINEAR CONVOLUTION UPSCALER
     ========================================================================== */
  const compViewerBox = document.getElementById('comp-viewer-box');
  const upSlitDivider = document.getElementById('up-divider-slit');
  const upOverlayBox = document.getElementById('up-overlay-container');
  const upImgBefore = document.getElementById('up-img-before');
  const upImgAfter = document.getElementById('up-img-after');
  const upProcessBtn = document.getElementById('up-process-btn');

  if (compViewerBox && upSlitDivider && upOverlayBox) {
    const updateSliderSplit = (clientX) => {
      const rect = compViewerBox.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
      upSlitDivider.style.left = `${percentage}%`;
      upOverlayBox.style.width = `${percentage}%`;
    };

    compViewerBox.addEventListener('mousemove', (e) => updateSliderSplit(e.clientX));
    compViewerBox.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) updateSliderSplit(e.touches[0].clientX);
    });
  }

  if (upProcessBtn) {
    upProcessBtn.addEventListener('click', () => {
      const moduleState = state['mod-upscaler'];
      if (moduleState.activeIdx === -1) return;
      
      const fileObj = moduleState.files[moduleState.activeIdx];
      fileObj.status = 'processing';
      updateModuleFileQueueUI('mod-upscaler');
      
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; 
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        if (document.getElementById('filter-sharpen').checked) {
          imgData = executeConvolutionKernel(ctx, imgData, [
             0, -0.5,  0,
          -0.5,    3, -0.5,
             0, -0.5,  0
          ]);
        }
        if (document.getElementById('filter-clarity').checked) {
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.min(255, Math.pow(d[i] / 255, 1.1) * 255 * 1.05);
            d[i+1] = Math.min(255, Math.pow(d[i+1] / 255, 1.1) * 255 * 1.05);
            d[i+2] = Math.min(255, Math.pow(d[i+2] / 255, 1.1) * 255 * 1.05);
          }
        }
        if (document.getElementById('filter-color').checked) {
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            let r = d[i], g = d[i+1], b = d[i+2];
            let v = 0.2126*r + 0.7152*g + 0.0722*b;
            d[i] = Math.min(255, Math.max(0, v + 1.25 * (r - v)));
            d[i+1] = Math.min(255, Math.max(0, v + 1.25 * (g - v)));
            d[i+2] = Math.min(255, Math.max(0, v + 1.25 * (b - v)));
          }
        }
        
        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob((blob) => {
          const outUrl = URL.createObjectURL(blob);
          const outFileName = `${fileObj.name.split('.')[0]}_enhanced.jpg`;
          upImgAfter.src = outUrl;
          
          moduleState.outputs = [{ blob, url: outUrl, name: outFileName }];
          
          fileObj.status = 'success';
          updateModuleFileQueueUI('mod-upscaler');
          toggleOutputsActionButtons('mod-upscaler', true);
        }, 'image/jpeg', 0.9);
      };
      img.src = fileObj.previewUrl;
    });
  }

  function executeConvolutionKernel(ctx, imgData, kernel) {
    const w = imgData.width; 
    const h = imgData.height;
    const src = imgData.data;
    const output = ctx.createImageData(w, h);
    const dst = output.data;
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let r=0, g=0, b=0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const srcIdx = ((y + ky) * w + (x + kx)) * 4;
            const weight = kernel[(ky + 1) * 3 + (kx + 1)];
            r += src[srcIdx] * weight; 
            g += src[srcIdx+1] * weight; 
            b += src[srcIdx+2] * weight;
          }
        }
        const idx = (y * w + x) * 4;
        dst[idx] = Math.min(255, Math.max(0, r));
        dst[idx+1] = Math.min(255, Math.max(0, g));
        dst[idx+2] = Math.min(255, Math.max(0, b));
        dst[idx+3] = src[idx+3];
      }
    }
    return output;
  }

  document.getElementById('up-download-btn').addEventListener('click', () => {
    const outputs = state['mod-upscaler'].outputs;
    if (outputs.length) {
      const a = document.createElement('a');
      a.href = outputs[0].url;
      a.download = outputs[0].name;
      a.click();
    }
  });

  document.getElementById('up-zip-btn').addEventListener('click', () => {
    document.getElementById('up-download-btn').click();
  });


  /* ==========================================================================
     MODULE 5: IMAGE RESIZER
     ========================================================================== */
  const resWidthInput = document.getElementById('resize-width');
  const resHeightInput = document.getElementById('resize-height');
  const resLockCheck = document.getElementById('resize-lock-aspect');
  const resExecuteBtn = document.getElementById('resize-process-btn');

  if (resWidthInput) {
    resWidthInput.addEventListener('input', () => {
      if (resLockCheck.checked && resizeImageObjectBuffer) {
        resHeightInput.value = Math.round(parseInt(resWidthInput.value) / resizeNativeAspectMemoryBuffer) || '';
      }
    });
  }
  if (resHeightInput) {
    resHeightInput.addEventListener('input', () => {
      if (resLockCheck.checked && resizeImageObjectBuffer) {
        resWidthInput.value = Math.round(parseInt(resHeightInput.value) * resizeNativeAspectMemoryBuffer) || '';
      }
    });
  }

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      resWidthInput.value = btn.getAttribute('data-w');
      resHeightInput.value = btn.getAttribute('data-h');
      if (resLockCheck.checked) resLockCheck.checked = false;
    });
  });

  if (resExecuteBtn) {
    resExecuteBtn.addEventListener('click', () => {
      const moduleState = state['mod-resizer'];
      if (moduleState.activeIdx === -1 || !resizeImageObjectBuffer) return;
      
      const fileObj = moduleState.files[moduleState.activeIdx];
      fileObj.status = 'processing';
      updateModuleFileQueueUI('mod-resizer');
      
      const canvas = document.createElement('canvas');
      const tw = parseInt(resWidthInput.value) || resizeImageObjectBuffer.width;
      const th = parseInt(resHeightInput.value) || resizeImageObjectBuffer.height;
      canvas.width = tw; 
      canvas.height = th;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(resizeImageObjectBuffer, 0, 0, tw, th);
      
      const format = document.getElementById('resize-format').value;
      const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
      
      canvas.toBlob((blob) => {
        const u = URL.createObjectURL(blob);
        const outFileName = `${fileObj.name.split('.')[0]}_resized.${extMap[format]}`;
        
        moduleState.outputs = [{ blob, url: u, name: outFileName }];
        fileObj.status = 'success';
        updateModuleFileQueueUI('mod-resizer');
        toggleOutputsActionButtons('mod-resizer', true);
      }, format, 0.85);
    });
  }

  document.getElementById('resize-download-btn').addEventListener('click', () => {
    const outputs = state['mod-resizer'].outputs;
    if (outputs.length) {
      const a = document.createElement('a');
      a.href = outputs[0].url;
      a.download = outputs[0].name;
      a.click();
    }
  });

  document.getElementById('resize-zip-btn').addEventListener('click', () => {
    document.getElementById('resize-download-btn').click();
  });


  /* ==========================================================================
     MODULE 6: PDF DOCUMENT HUB
     ========================================================================== */
  const pdfCreateBtn = document.getElementById('pdf-process-btn');
  const pdfOutputGrid = document.getElementById('pdf-output-grid');

  if (pdfCreateBtn) {
    pdfCreateBtn.addEventListener('click', async () => {
      const moduleState = state['mod-pdf'];
      if (!moduleState.files.length) return;
      
      const activeFile = moduleState.files[moduleState.activeIdx];
      pdfOutputGrid.innerHTML = '';
      moduleState.outputs = [];
      
      // If it is a PDF -> extract
      if (activeFile.name.endsWith('.pdf')) {
        if (!activePdfDocStreamMemoryBuffer) return;
        activeFile.status = 'processing';
        updateModuleFileQueueUI('mod-pdf');
        
        const targetFormat = document.getElementById('pdf-extract-format').value;
        const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

        for (let p = 1; p <= activePdfDocStreamMemoryBuffer.numPages; p++) {
          await activePdfDocStreamMemoryBuffer.getPage(p).then(async (page) => {
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width; 
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            
            await page.render({ canvasContext: ctx, viewport: viewport }).promise.then(() => {
              return new Promise(resolve => {
                canvas.toBlob((blob) => {
                  const u = URL.createObjectURL(blob);
                  const outName = `${activeFile.name.split('.')[0]}_page_${p}.${extMap[targetFormat]}`;
                  moduleState.outputs.push({ blob, url: u, name: outName });

                  const card = document.createElement('div'); 
                  card.className = 'gallery-card';
                  
                  const outImg = document.createElement('img'); 
                  outImg.src = u;
                  
                  const lbl = document.createElement('div'); 
                  lbl.className = 'gallery-meta'; 
                  lbl.textContent = `Page ${p}`;
                  
                  const saveBtn = document.createElement('a');
                  saveBtn.className = 'btn btn-primary';
                  saveBtn.innerHTML = '<i data-lucide="download"></i> Save';
                  saveBtn.href = u;
                  saveBtn.download = outName;
                  saveBtn.style.padding = '0.3rem 0.6rem';
                  saveBtn.style.fontSize = '0.75rem';
                  saveBtn.style.width = 'auto';

                  card.appendChild(outImg); 
                  card.appendChild(lbl); 
                  card.appendChild(saveBtn);
                  pdfOutputGrid.appendChild(card);
                  resolve();
                }, targetFormat, 0.9);
              });
            });
          });
        }
        activeFile.status = 'success';
        updateModuleFileQueueUI('mod-pdf');
      } 
      // If they are images -> Compile to PDF
      else {
        activeFile.status = 'processing';
        updateModuleFileQueueUI('mod-pdf');
        
        const mode = document.querySelector('input[name="pdf-page-mode"]:checked').value;
        const { jsPDF } = window.jspdf;
        
        if (mode === 'single') {
          const pdf = new jsPDF();
          for (let i = 0; i < moduleState.files.length; i++) {
            if (i > 0) pdf.addPage();
            await addImageToPdfCanvasHelper(pdf, moduleState.files[i]);
          }
          const blob = pdf.output('blob');
          const u = URL.createObjectURL(blob);
          const outName = "compiled_document.pdf";
          moduleState.outputs = [{ blob, url: u, name: outName }];
          
          const card = document.createElement('div');
          card.className = 'gallery-card';
          card.innerHTML = `
            <i data-lucide="file" style="width:48px; height:48px; color:var(--primary);"></i>
            <div class="gallery-meta">Single PDF Document</div>
            <a class="btn btn-primary" href="${u}" download="${outName}" style="padding:0.3rem 0.6rem; font-size:0.75rem; width:auto;">
              <i data-lucide="download"></i> Save
            </a>
          `;
          pdfOutputGrid.appendChild(card);
        } else {
          for (let i = 0; i < moduleState.files.length; i++) {
            const pdf = new jsPDF();
            await addImageToPdfCanvasHelper(pdf, moduleState.files[i]);
            const blob = pdf.output('blob');
            const u = URL.createObjectURL(blob);
            const outName = `compiled_page_${i + 1}.pdf`;
            moduleState.outputs.push({ blob, url: u, name: outName });
            
            const card = document.createElement('div');
            card.className = 'gallery-card';
            card.innerHTML = `
              <i data-lucide="file" style="width:48px; height:48px; color:var(--primary);"></i>
              <div class="gallery-meta">Page ${i + 1} PDF</div>
              <a class="btn btn-primary" href="${u}" download="${outName}" style="padding:0.3rem 0.6rem; font-size:0.75rem; width:auto;">
                <i data-lucide="download"></i> Save
              </a>
            `;
            pdfOutputGrid.appendChild(card);
          }
        }
        activeFile.status = 'success';
        updateModuleFileQueueUI('mod-pdf');
      }
      
      toggleOutputsActionButtons('mod-pdf', true);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }

  async function addImageToPdfCanvasHelper(pdfInstance, fileObj) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = function() {
        const pW = pdfInstance.internal.pageSize.getWidth();
        const pH = pdfInstance.internal.pageSize.getHeight();
        const scale = Math.min(pW / img.width, pH / img.height);
        pdfInstance.addImage(img, 'JPEG', 0, 0, img.width * scale, img.height * scale);
        resolve();
      };
      img.src = fileObj.previewUrl;
    });
  }

  document.getElementById('pdf-download-btn').addEventListener('click', () => {
    const outputs = state['mod-pdf'].outputs;
    if (outputs.length) {
      outputs.forEach(out => {
        const a = document.createElement('a');
        a.href = out.url;
        a.download = out.name;
        a.click();
      });
    }
  });

  document.getElementById('pdf-zip-btn').addEventListener('click', async () => {
    const outputs = state['mod-pdf'].outputs;
    if (!outputs.length) return;
    const zip = new JSZip();
    outputs.forEach(out => zip.file(out.name, out.blob));
    const content = await zip.generateAsync({ type: "blob" });
    const u = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = u;
    a.download = "pdf_extracted_documents.zip";
    a.click();
  });


  /* ==========================================================================
     MODULE 7: SVG HIGH-RESOLUTION RASTERIZER
     ========================================================================== */
  const svgProcessBtn = document.getElementById('svg-process-btn');
  const svgBgRadioGroup = document.getElementsByName('svg-bg-mode');
  const svgSolidColorWrap = document.getElementById('svg-solid-color-wrap');
  const svgOutputGrid = document.getElementById('svg-output-grid');

  svgBgRadioGroup.forEach(el => {
    el.addEventListener('change', () => {
      const activeVal = document.querySelector('input[name="svg-bg-mode"]:checked').value;
      if (svgSolidColorWrap) {
        svgSolidColorWrap.style.display = (activeVal === 'solid') ? 'flex' : 'none';
      }
    });
  });

  if (svgProcessBtn) {
    svgProcessBtn.addEventListener('click', () => {
      const moduleState = state['mod-svg'];
      if (moduleState.activeIdx === -1 || !svgTextStreamMemoryBuffer) return;
      
      const fileObj = moduleState.files[moduleState.activeIdx];
      fileObj.status = 'processing';
      updateModuleFileQueueUI('mod-svg');
      
      svgOutputGrid.innerHTML = '';
      
      const scale = parseInt(document.getElementById('svg-scale-factor').value) || 1;
      const bgMode = document.querySelector('input[name="svg-bg-mode"]:checked').value;
      const bgColor = document.getElementById('svg-bg-color').value || "#FFFFFF";
      const outFormat = document.getElementById('svg-output-format').value;
      const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgTextStreamMemoryBuffer, "image/svg+xml");
      const svgEl = doc.documentElement;

      let nativeW = parseFloat(svgEl.getAttribute('width'));
      let nativeH = parseFloat(svgEl.getAttribute('height'));
      
      const viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/\s+/).map(parseFloat);
        if (parts.length === 4) {
          if (isNaN(nativeW)) nativeW = parts[2];
          if (isNaN(nativeH)) nativeH = parts[3];
        }
      }
      
      if (isNaN(nativeW)) nativeW = 300;
      if (isNaN(nativeH)) nativeH = 150;
      
      svgEl.setAttribute('viewBox', viewBox || `0 0 ${nativeW} ${nativeH}`);
      
      const tw = nativeW * scale; 
      const th = nativeH * scale;
      svgEl.setAttribute('width', tw); 
      svgEl.setAttribute('height', th);

      const serializedSvg = new XMLSerializer().serializeToString(svgEl);
      const blobSvg = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
      const u = URL.createObjectURL(blobSvg);
      
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = tw; 
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        
        if (bgMode === 'solid') {
          ctx.fillStyle = bgColor; 
          ctx.fillRect(0, 0, tw, th);
        }
        
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(u);
          const outUrl = URL.createObjectURL(blob);
          const outFileName = `${fileObj.name.split('.')[0]}_raster.${extMap[outFormat]}`;
          moduleState.outputs = [{ blob, url: outUrl, name: outFileName }];
          
          const card = document.createElement('div'); 
          card.className = 'gallery-card';
          
          const finalImg = document.createElement('img'); 
          finalImg.src = outUrl;
          
          const lbl = document.createElement('div'); 
          lbl.className = 'gallery-meta'; 
          lbl.textContent = formatBytesToKB(blob.size);
          
          const saveBtn = document.createElement('a');
          saveBtn.className = 'btn btn-primary';
          saveBtn.innerHTML = '<i data-lucide="download"></i> Save';
          saveBtn.href = outUrl;
          saveBtn.download = outFileName;
          saveBtn.style.padding = '0.3rem 0.6rem';
          saveBtn.style.fontSize = '0.75rem';
          saveBtn.style.width = 'auto';

          card.appendChild(finalImg); 
          card.appendChild(lbl); 
          card.appendChild(saveBtn);
          svgOutputGrid.appendChild(card);
          
          fileObj.status = 'success';
          updateModuleFileQueueUI('mod-svg');
          toggleOutputsActionButtons('mod-svg', true);
        }, outFormat, 0.9);
      };
      img.src = u;
    });
  }

  document.getElementById('svg-download-btn').addEventListener('click', () => {
    const outputs = state['mod-svg'].outputs;
    if (outputs.length) {
      const a = document.createElement('a');
      a.href = outputs[0].url;
      a.download = outputs[0].name;
      a.click();
    }
  });

  document.getElementById('svg-zip-btn').addEventListener('click', () => {
    document.getElementById('svg-download-btn').click();
  });


  /* ==========================================================================
     MODULE 8: BACKGROUND REMOVER (NEW!)
     ========================================================================== */
  const bgComparisonBox = document.getElementById('bg-comparison-box');
  const bgSlitDivider = document.getElementById('bg-divider-slit');
  const bgOverlayBox = document.getElementById('bg-overlay-container');
  const bgImgBefore = document.getElementById('bg-img-before');
  const bgImgAfter = document.getElementById('bg-img-after');
  const bgProcessBtn = document.getElementById('bg-process-btn');
  const bgOutputGrid = document.getElementById('bg-output-grid');
  
  const bgExtractSelect = document.getElementById('bg-extract-mode');
  const bgSolidGroup = document.getElementById('bg-solid-config-group');
  const bgGradientGroup = document.getElementById('bg-gradient-config-group');
  const bgImageGroup = document.getElementById('bg-image-config-group');
  
  const bgToleranceSlider = document.getElementById('bg-tolerance');
  const bgFeatherSlider = document.getElementById('bg-feather');
  const bgAngleSlider = document.getElementById('bg-grad-angle');

  // Trigger correct sub-panels based on background remover option
  if (bgExtractSelect) {
    bgExtractSelect.addEventListener('change', () => {
      const val = bgExtractSelect.value;
      bgSolidGroup.style.display = (val === 'solid') ? 'block' : 'none';
      bgGradientGroup.style.display = (val === 'gradient') ? 'flex' : 'none';
      bgImageGroup.style.display = (val === 'image') ? 'block' : 'none';
    });
  }

  // Tolerance slider values readouts
  if (bgToleranceSlider) {
    bgToleranceSlider.addEventListener('input', (e) => {
      document.getElementById('bg-tolerance-val').textContent = e.target.value + '%';
    });
  }
  if (bgFeatherSlider) {
    bgFeatherSlider.addEventListener('input', (e) => {
      document.getElementById('bg-feather-val').textContent = e.target.value + 'px';
    });
  }
  if (bgAngleSlider) {
    bgAngleSlider.addEventListener('input', (e) => {
      document.getElementById('bg-grad-angle-val').textContent = e.target.value + '°';
    });
  }

  // Chain checkboxes inputs show/hide
  document.getElementById('chain-resize').addEventListener('change', (e) => {
    document.getElementById('chain-resize-group').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('chain-convert').addEventListener('change', (e) => {
    document.getElementById('chain-convert-group').style.display = e.target.checked ? 'flex' : 'none';
  });
  if (document.getElementById('chain-export-quality')) {
    document.getElementById('chain-export-quality').addEventListener('input', (e) => {
      document.getElementById('chain-export-quality-val').textContent = e.target.value + '%';
    });
  }

  // Color Swatch triggers for color picking
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const color = sw.getAttribute('data-color');
      document.getElementById('bg-solid-color').value = color;
    });
  });

  // Slider controls comparison mapping
  if (bgComparisonBox && bgSlitDivider && bgOverlayBox) {
    const updateBgSliderSplit = (clientX) => {
      const rect = bgComparisonBox.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
      bgSlitDivider.style.left = `${percentage}%`;
      bgOverlayBox.style.width = `${percentage}%`;
    };

    bgComparisonBox.addEventListener('mousemove', (e) => updateBgSliderSplit(e.clientX));
    bgComparisonBox.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) updateBgSliderSplit(e.touches[0].clientX);
    });
  }

  // Drag and drop for custom background image
  setupDragAndDropEngine('bg-bgimg-drop', 'bg-bgimg-input', (files) => {
    const file = files[0];
    const u = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function() {
      state['mod-bg-remover'].bgImgObject = img;
      document.getElementById('bg-bgimg-meta').textContent = `${file.name} (${formatBytesToKB(file.size)})`;
    };
    img.src = u;
  });

  // Background Removal Boundary Connected Flood-Fill Mask Algorithm
  function generateBackgroundRemovalMask(imgData, targetColor, tolerance) {
    const w = imgData.width;
    const h = imgData.height;
    const data = imgData.data;
    
    // Visited flags and initial opaque mask (255)
    const visited = new Uint8Array(w * h);
    const mask = new Uint8Array(w * h);
    mask.fill(255);
    
    const [targetR, targetG, targetB] = targetColor;
    
    // BFS Queue (using simple array, safe for typical image sizes)
    const queue = [];
    
    // Add all boundary pixels to the queue
    for (let x = 0; x < w; x++) {
      queue.push(0 * w + x); // top row
      queue.push((h - 1) * w + x); // bottom row
    }
    for (let y = 1; y < h - 1; y++) {
      queue.push(y * w + 0); // left column
      queue.push(y * w + (w - 1)); // right column
    }
    
    // Color distance check
    const isMatchingColor = (idx) => {
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      // Euclidean distance in color space
      const dist = Math.sqrt((r - targetR)**2 + (g - targetG)**2 + (b - targetB)**2) / 441.67 * 100;
      return dist <= tolerance;
    };
    
    let head = 0;
    while (head < queue.length) {
      const pos = queue[head++];
      if (visited[pos]) continue;
      visited[pos] = 1;
      
      const x = pos % w;
      const y = Math.floor(pos / w);
      const dataIdx = pos * 4;
      
      if (isMatchingColor(dataIdx)) {
        mask[pos] = 0; // Erase matching background pixel
        
        // Add 4-connected neighbors
        if (x > 0 && !visited[pos - 1]) queue.push(pos - 1);
        if (x < w - 1 && !visited[pos + 1]) queue.push(pos + 1);
        if (y > 0 && !visited[pos - w]) queue.push(pos - w);
        if (y < h - 1 && !visited[pos + w]) queue.push(pos + w);
      }
    }
    
    return mask;
  }

  // Apply feathered soft boundaries on alpha channel mask
  function featherBackgroundMask(mask, w, h, radius) {
    if (radius <= 0) return mask;
    const output = new Uint8Array(w * h);
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let count = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              sum += mask[ny * w + nx];
              count++;
            }
          }
        }
        output[y * w + x] = Math.round(sum / count);
      }
    }
    
    return output;
  }

  // Main Background Remover execution and Pipeline Chaining
  if (bgProcessBtn) {
    bgProcessBtn.addEventListener('click', () => {
      const moduleState = state['mod-bg-remover'];
      if (moduleState.activeIdx === -1 || !bgFileObjectBuffer) return;
      
      const fileObj = moduleState.files[moduleState.activeIdx];
      fileObj.status = 'processing';
      updateModuleFileQueueUI('mod-bg-remover');
      
      // Show progress bar
      const barContainer = document.getElementById('bg-progress-bar');
      const barFill = document.getElementById('bg-progress-fill');
      if (barContainer) barContainer.style.display = 'block';
      if (barFill) barFill.style.width = '20%';
      
      const img = new Image();
      img.onload = function() {
        const w = img.width;
        const h = img.height;
        
        // Canvas for processing removal
        const canvas = document.createElement('canvas');
        canvas.width = w; 
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        
        // Sample top-left corner color at (0,0) as background reference
        const targetColor = [data[0], data[1], data[2]];
        const tolerance = parseInt(bgToleranceSlider.value);
        const featherRadius = parseInt(bgFeatherSlider.value);
        
        // Step 1: Generate Flood-fill Alpha Mask
        if (barFill) barFill.style.width = '40%';
        let mask = generateBackgroundRemovalMask(imgData, targetColor, tolerance);
        
        // Step 2: Smooth edges
        if (barFill) barFill.style.width = '60%';
        mask = featherBackgroundMask(mask, w, h, featherRadius);
        
        // Step 3: Apply mask to alpha channel
        for (let i = 0; i < mask.length; i++) {
          data[i * 4 + 3] = mask[i];
        }
        ctx.putImageData(imgData, 0, 0);
        
        // Staging Canvas for Compositing backgrounds
        const bgMode = bgExtractSelect.value;
        const compositingCanvas = document.createElement('canvas');
        compositingCanvas.width = w; 
        compositingCanvas.height = h;
        const compCtx = compositingCanvas.getContext('2d');
        
        if (bgMode === 'white') {
          compCtx.fillStyle = '#FFFFFF';
          compCtx.fillRect(0, 0, w, h);
        } 
        else if (bgMode === 'solid') {
          compCtx.fillStyle = document.getElementById('bg-solid-color').value;
          compCtx.fillRect(0, 0, w, h);
        }
        else if (bgMode === 'gradient') {
          const gradType = document.getElementById('bg-gradient-type').value;
          const startC = document.getElementById('bg-grad-start').value;
          const endC = document.getElementById('bg-grad-end').value;
          
          let gradient;
          if (gradType === 'radial') {
            gradient = compCtx.createRadialGradient(w/2, h/2, 5, w/2, h/2, Math.max(w, h)/2);
          } else {
            const angle = parseInt(bgAngleSlider.value);
            const rad = (angle * Math.PI) / 180;
            const x1 = w/2 - Math.cos(rad) * w/2;
            const y1 = h/2 - Math.sin(rad) * h/2;
            const x2 = w/2 + Math.cos(rad) * w/2;
            const y2 = h/2 + Math.sin(rad) * h/2;
            gradient = compCtx.createLinearGradient(x1, y1, x2, y2);
          }
          gradient.addColorStop(0, startC);
          gradient.addColorStop(1, endC);
          compCtx.fillStyle = gradient;
          compCtx.fillRect(0, 0, w, h);
        }
        else if (bgMode === 'image' && moduleState.bgImgObject) {
          const bgImg = moduleState.bgImgObject;
          const scale = Math.max(w / bgImg.width, h / bgImg.height);
          const dw = bgImg.width * scale;
          const dh = bgImg.height * scale;
          const dx = (w - dw) / 2;
          const dy = (h - dh) / 2;
          compCtx.drawImage(bgImg, dx, dy, dw, dh);
        }
        
        // Draw the transparent foreground
        compCtx.drawImage(canvas, 0, 0);
        
        // Workflow Chaining Pipelines
        if (barFill) barFill.style.width = '80%';
        let finalWorkingCanvas = compositingCanvas;
        
        // A. Apply high-pass sharpening filter
        if (document.getElementById('chain-enhance').checked) {
          const chainCtx = finalWorkingCanvas.getContext('2d');
          let cData = chainCtx.getImageData(0, 0, w, h);
          cData = executeConvolutionKernel(chainCtx, cData, [
             0, -0.5,  0,
          -0.5,    3, -0.5,
             0, -0.5,  0
          ]);
          chainCtx.putImageData(cData, 0, 0);
        }
        
        // B. Resize to specific dimensions
        if (document.getElementById('chain-resize').checked) {
          const targetW = parseInt(document.getElementById('chain-resize-w').value) || w;
          const targetH = parseInt(document.getElementById('chain-resize-h').value) || h;
          
          const resizeCanvas = document.createElement('canvas');
          resizeCanvas.width = targetW; 
          resizeCanvas.height = targetH;
          const resizeCtx = resizeCanvas.getContext('2d');
          resizeCtx.drawImage(finalWorkingCanvas, 0, 0, targetW, targetH);
          finalWorkingCanvas = resizeCanvas;
        }
        
        // C. Target Format Selection
        let exportFormat = document.getElementById('bg-export-format').value;
        let exportQuality = parseFloat(document.getElementById('bg-export-quality').value) / 100;
        
        if (document.getElementById('chain-convert').checked) {
          exportFormat = document.getElementById('chain-export-format').value;
          exportQuality = parseFloat(document.getElementById('chain-export-quality').value) / 100;
        }
        
        const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
        
        finalWorkingCanvas.toBlob((blob) => {
          if (barFill) barFill.style.width = '100%';
          const outUrl = URL.createObjectURL(blob);
          const outFileName = `${fileObj.name.split('.')[0]}_processed.${extMap[exportFormat]}`;
          
          bgImgAfter.src = outUrl;
          moduleState.outputs = [{ blob, url: outUrl, name: outFileName }];
          
          const card = document.createElement('div');
          card.className = 'gallery-card';
          
          const imgEl = document.createElement('img');
          imgEl.src = outUrl;
          
          const meta = document.createElement('div');
          meta.className = 'gallery-meta';
          meta.textContent = formatBytesToKB(blob.size);
          
          const saveBtn = document.createElement('a');
          saveBtn.className = 'btn btn-primary';
          saveBtn.innerHTML = '<i data-lucide="download"></i> Save';
          saveBtn.href = outUrl;
          saveBtn.download = outFileName;
          saveBtn.style.padding = '0.3rem 0.6rem';
          saveBtn.style.fontSize = '0.75rem';
          saveBtn.style.width = 'auto';
          
          card.appendChild(imgEl);
          card.appendChild(meta);
          card.appendChild(saveBtn);
          bgOutputGrid.innerHTML = '';
          bgOutputGrid.appendChild(card);
          
          fileObj.status = 'success';
          updateModuleFileQueueUI('mod-bg-remover');
          toggleOutputsActionButtons('mod-bg-remover', true);
          
          setTimeout(() => {
            if (barContainer) barContainer.style.display = 'none';
          }, 600);
          
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }, exportFormat, exportQuality);
      };
      img.src = fileObj.previewUrl;
    });
  }

  document.getElementById('bg-download-btn').addEventListener('click', () => {
    const outputs = state['mod-bg-remover'].outputs;
    if (outputs.length) {
      const a = document.createElement('a');
      a.href = outputs[0].url;
      a.download = outputs[0].name;
      a.click();
    }
  });

  document.getElementById('bg-zip-btn').addEventListener('click', () => {
    document.getElementById('bg-download-btn').click();
  });
});
