// Backend URL sẽ được lấy động từ giao diện

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    
    // Single View Elements
    const singleView = document.getElementById('single-view');
    const resultImage = document.getElementById('result-image');
    const singleLoading = document.getElementById('single-loading');
    const downloadBtn = document.getElementById('download-btn');
    const resetSingleBtn = document.getElementById('reset-single-btn');
    
    // Batch View Elements
    const batchView = document.getElementById('batch-view');
    const totalFilesEl = document.getElementById('total-files');
    const progressBar = document.getElementById('progress-bar');
    const batchStatus = document.getElementById('batch-status');
    const fileListEl = document.getElementById('file-list');
    const downloadZipBtn = document.getElementById('download-zip-btn');
    const resetBatchBtn = document.getElementById('reset-batch-btn');
    
    // Settings
    const modelSelect = document.getElementById('model-select');
    const alphaMatting = document.getElementById('alpha-matting');
    const maskThreshold = document.getElementById('mask-threshold');
    const backendUrlInput = document.getElementById('backend-url');

    // Initialize backend URL from localStorage or default
    const savedBackendUrl = localStorage.getItem('bg_remover_backend_url');
    if (savedBackendUrl) {
        backendUrlInput.value = savedBackendUrl;
    } else {
        // Mặc định cho local development nếu chưa có
        backendUrlInput.value = 'http://127.0.0.1:8080';
    }

    // Lắng nghe thay đổi để lưu lại
    backendUrlInput.addEventListener('change', (e) => {
        let url = e.target.value.trim();
        // Xóa dấu slash ở cuối nếu có
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        e.target.value = url;
        localStorage.setItem('bg_remover_backend_url', url);
    });

    // Helper function lấy backend URL hiện tại
    function getBackendUrl() {
        return backendUrlInput.value.trim() || 'http://127.0.0.1:8080';
    }

    let currentSingleBlob = null;
    let currentSingleFilename = null;
    let currentBatchBlob = null;

    // --- Drag and Drop Logic ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const items = e.dataTransfer.items;
        if (!items) return;

        const files = [];
        
        // Helper to read entries recursively
        async function readEntry(entry) {
            if (entry.isFile) {
                return new Promise((resolve) => {
                    entry.file(file => {
                        if (file.type.startsWith('image/')) {
                            files.push(file);
                        }
                        resolve();
                    });
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                return new Promise((resolve) => {
                    dirReader.readEntries(async (entries) => {
                        for (let child of entries) {
                            await readEntry(child);
                        }
                        resolve();
                    });
                });
            }
        }

        // Process all dropped items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    await readEntry(entry);
                }
            }
        }

        handleFiles(files);
    });

    // Click to upload
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        handleFiles(files);
    });

    function handleFiles(files) {
        if (files.length === 0) return;
        
        dropZone.classList.add('hidden');
        
        if (files.length === 1) {
            // Single Mode
            singleView.classList.remove('hidden');
            processSingle(files[0]);
        } else {
            // Batch Mode
            batchView.classList.remove('hidden');
            processBatch(files);
        }
    }

    // --- Single File Processing ---
    async function processSingle(file) {
        singleLoading.classList.remove('hidden');
        downloadBtn.classList.add('hidden');
        
        // Show original image preview temporarily
        resultImage.src = URL.createObjectURL(file);
        resultImage.style.opacity = '0.5';

        const formData = new FormData();
        formData.append('image', file);
        formData.append('model', modelSelect.value);
        formData.append('alpha_matting', alphaMatting.checked);
        formData.append('mask_threshold', maskThreshold.value);

        try {
            const currentBackendUrl = getBackendUrl();
            const response = await fetch(`${currentBackendUrl}/api/process-single`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Processing failed');

            const blob = await response.blob();
            currentSingleBlob = blob;
            
            // Generate output filename: keeping name exactly same, change extension to .png
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            currentSingleFilename = `${baseName}.png`;

            resultImage.src = URL.createObjectURL(blob);
            resultImage.style.opacity = '1';
            
            singleLoading.classList.add('hidden');
            downloadBtn.classList.remove('hidden');
            
        } catch (error) {
            console.error(error);
            alert('Lỗi xử lý ảnh: ' + error.message);
            resetUI();
        }
    }

    downloadBtn.addEventListener('click', () => {
        if (currentSingleBlob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(currentSingleBlob);
            a.download = currentSingleFilename;
            a.click();
        }
    });

    // --- Batch Processing ---
    async function processBatch(files) {
        totalFilesEl.textContent = files.length;
        fileListEl.innerHTML = '';
        downloadZipBtn.classList.add('hidden');
        progressBar.style.width = '0%';
        
        files.forEach(f => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${f.name}</span> <span class="status status-pending">Đang đợi</span>`;
            fileListEl.appendChild(li);
        });

        batchStatus.textContent = 'Đang tải lên và xử lý...';
        progressBar.style.width = '50%';

        const formData = new FormData();
        files.forEach(f => formData.append('images', f));
        formData.append('model', modelSelect.value);
        formData.append('alpha_matting', alphaMatting.checked);
        formData.append('mask_threshold', maskThreshold.value);

        try {
            const currentBackendUrl = getBackendUrl();
            // Processing all at once on backend for simplicity in this version
            // In a production app, we would stream or do one by one via WebSocket
            const response = await fetch(`${currentBackendUrl}/api/process-batch`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Batch processing failed');

            currentBatchBlob = await response.blob();
            
            progressBar.style.width = '100%';
            batchStatus.textContent = 'Hoàn tất!';
            
            const listItems = fileListEl.querySelectorAll('li .status');
            listItems.forEach(el => {
                el.textContent = 'Hoàn tất';
                el.className = 'status status-done';
            });

            downloadZipBtn.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            batchStatus.textContent = 'Lỗi: ' + error.message;
            progressBar.style.backgroundColor = 'var(--error-color)';
            
            const listItems = fileListEl.querySelectorAll('li .status');
            listItems.forEach(el => {
                el.textContent = 'Lỗi';
                el.className = 'status status-error';
            });
        }
    }

    downloadZipBtn.addEventListener('click', () => {
        if (currentBatchBlob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(currentBatchBlob);
            a.download = 'processed_images.zip';
            a.click();
        }
    });

    // --- Reset ---
    function resetUI() {
        dropZone.classList.remove('hidden');
        singleView.classList.add('hidden');
        batchView.classList.add('hidden');
        fileInput.value = '';
        currentSingleBlob = null;
        currentBatchBlob = null;
    }

    resetSingleBtn.addEventListener('click', resetUI);
    resetBatchBtn.addEventListener('click', resetUI);
});
