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
    const stopBatchBtn = document.getElementById('stop-batch-btn');
    const resetBatchBtn = document.getElementById('reset-batch-btn');
    
    // Settings
    const modelSelect = document.getElementById('model-select');
    const alphaMatting = document.getElementById('alpha-matting');
    const maskThreshold = document.getElementById('mask-threshold');
    const fit32 = document.getElementById('fit-3-2');
    const backendUrlInput = document.getElementById('backend-url');

    // Initialize backend URL from localStorage or default
    const savedBackendUrl = localStorage.getItem('bg_remover_backend_url');
    if (savedBackendUrl && savedBackendUrl !== 'http://127.0.0.1:8080') {
        backendUrlInput.value = savedBackendUrl;
    } else {
        // Cố định ngrok URL hiện tại theo yêu cầu
        backendUrlInput.value = 'https://b26e-2402-800-63b9-fd3b-41b4-1552-669a-527e.ngrok-free.app';
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
        return backendUrlInput.value.trim() || 'https://b26e-2402-800-63b9-fd3b-41b4-1552-669a-527e.ngrok-free.app';
    }

    let currentSingleBlob = null;
    let currentSingleFilename = null;
    let currentBatchBlob = null;
    let isStopped = false;

    // --- ZIP Extraction Logic ---
    async function extractZip(zipFile) {
        const extractedFiles = [];
        try {
            if (typeof JSZip === 'undefined') {
                throw new Error('Thư viện JSZip chưa được tải!');
            }
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(zipFile);
            
            const promises = [];
            zip.forEach((relativePath, zipEntry) => {
                if (zipEntry.dir) return;
                const lowerName = zipEntry.name.toLowerCase();
                if (!lowerName.endsWith('.jpg') && !lowerName.endsWith('.jpeg') && !lowerName.endsWith('.png')) return;
                if (relativePath.includes('__MACOSX') || zipEntry.name.split('/').pop().startsWith('.')) return;
                
                promises.push(
                    zipEntry.async('blob').then(blob => {
                        const fileName = zipEntry.name.split('/').pop();
                        const fileType = lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg';
                        const file = new File([blob], fileName, { type: fileType });
                        extractedFiles.push(file);
                    })
                );
            });
            await Promise.all(promises);
        } catch (error) {
            console.error('Lỗi giải nén ZIP:', error);
            alert('Có lỗi khi bung file ZIP: ' + zipFile.name + '\n' + error.message);
        }
        return extractedFiles;
    }

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
                    entry.file(async (file) => {
                        if (file.type.startsWith('image/')) {
                            files.push(file);
                        } else if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip') {
                            const extracted = await extractZip(file);
                            files.push(...extracted);
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

    fileInput.addEventListener('change', async (e) => {
        let files = [];
        const inputFiles = Array.from(e.target.files);
        for (const f of inputFiles) {
            if (f.type.startsWith('image/')) {
                files.push(f);
            } else if (f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip') {
                const extracted = await extractZip(f);
                files.push(...extracted);
            }
        }
        handleFiles(files);
        // Reset giá trị input để chọn lại file cùng tên không bị lỗi
        e.target.value = '';
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
        formData.append('fit_3_2', fit32.checked);

        try {
            const currentBackendUrl = getBackendUrl();
            const response = await fetch(`${currentBackendUrl}/api/process-single`, {
                method: 'POST',
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                },
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
        stopBatchBtn.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressBar.style.backgroundColor = 'var(--primary-color)';
        isStopped = false;
        
        files.forEach((f, index) => {
            const li = document.createElement('li');
            li.id = `file-item-${index}`;
            li.innerHTML = `<span>${f.name}</span> <span class="status status-pending">Đang đợi</span>`;
            fileListEl.appendChild(li);
        });

        const currentBackendUrl = getBackendUrl();
        const batchSize = 20;
        let processedCount = 0;

        for (let i = 0; i < files.length; i += batchSize) {
            if (isStopped) {
                batchStatus.textContent = `Đã dừng xử lý. Hoàn thành ${processedCount}/${files.length} ảnh.`;
                stopBatchBtn.classList.add('hidden');
                return;
            }

            const chunk = files.slice(i, i + batchSize);
            const chunkIndices = Array.from({length: chunk.length}, (_, idx) => i + idx);
            
            chunkIndices.forEach(idx => {
                const statusSpan = document.querySelector(`#file-item-${idx} .status`);
                if(statusSpan) {
                    statusSpan.textContent = 'Đang xử lý';
                    statusSpan.className = 'status status-processing';
                }
            });

            batchStatus.textContent = `Đang xử lý batch ${Math.floor(i/batchSize) + 1} (${i + 1}-${Math.min(i + batchSize, files.length)})...`;

            const formData = new FormData();
            chunk.forEach(f => formData.append('images', f));
            formData.append('model', modelSelect.value);
            formData.append('alpha_matting', alphaMatting.checked);
            formData.append('mask_threshold', maskThreshold.value);
            formData.append('fit_3_2', fit32.checked);

            try {
                const response = await fetch(`${currentBackendUrl}/api/process-batch`, {
                    method: 'POST',
                    headers: {
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: formData
                });

                if (!response.ok) throw new Error('Batch processing failed');

                currentBatchBlob = await response.blob();
                
                const a = document.createElement('a');
                a.href = URL.createObjectURL(currentBatchBlob);
                a.download = `processed_images_batch_${Math.floor(i/batchSize) + 1}.zip`;
                a.click();
                
                chunkIndices.forEach(idx => {
                    const statusSpan = document.querySelector(`#file-item-${idx} .status`);
                    if(statusSpan) {
                        statusSpan.textContent = 'Hoàn tất';
                        statusSpan.className = 'status status-done';
                    }
                });

                processedCount += chunk.length;
                progressBar.style.width = `${(processedCount / files.length) * 100}%`;

            } catch (error) {
                console.error(error);
                batchStatus.textContent = `Lỗi tại batch ${Math.floor(i/batchSize) + 1}: ${error.message}`;
                progressBar.style.backgroundColor = 'var(--error-color)';
                
                chunkIndices.forEach(idx => {
                    const statusSpan = document.querySelector(`#file-item-${idx} .status`);
                    if(statusSpan) {
                        statusSpan.textContent = 'Lỗi';
                        statusSpan.className = 'status status-error';
                    }
                });
                stopBatchBtn.classList.add('hidden');
                return;
            }
        }
        
        batchStatus.textContent = 'Hoàn tất toàn bộ!';
        stopBatchBtn.classList.add('hidden');
    }

    stopBatchBtn.addEventListener('click', () => {
        isStopped = true;
    });

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
