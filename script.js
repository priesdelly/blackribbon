/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                  Black Ribbon Memorial Overlay                            ║
 * ║                     Powered by Priesdelly                                 ║
 * ║                  © 2025 - github.com/priesdelly                           ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  A respectful tool for adding memorial ribbons to images                  ║
 * ║  Built with privacy in mind - All processing happens client-side          ║
 * ║  No data is collected, stored, or transmitted to any server               ║
 * ║                                                                            ║
 * ║  Created with love and respect for those we remember 🕯️                   ║
 * ║  May this tool help preserve precious memories with dignity               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// Notice Banner Toggle Function
function toggleNotice() {
    const content = document.getElementById('noticeContent');
    const toggle = document.getElementById('noticeToggle');
    const banner = document.getElementById('noticeBanner');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▼';
        banner.classList.remove('collapsed');
        // Save expanded state
        localStorage.setItem('noticeBannerCollapsed', 'false');
    } else {
        content.style.display = 'none';
        toggle.textContent = '▶';
        banner.classList.add('collapsed');
        // Save collapsed state
        localStorage.setItem('noticeBannerCollapsed', 'true');
    }
}

// Initialize Notice Banner State
function initializeNoticeState() {
    const content = document.getElementById('noticeContent');
    const toggle = document.getElementById('noticeToggle');
    const banner = document.getElementById('noticeBanner');

    // Get saved state from localStorage (default to false = expanded)
    const isCollapsed = localStorage.getItem('noticeBannerCollapsed') === 'true';

    if (isCollapsed) {
        content.style.display = 'none';
        toggle.textContent = '▶';
        banner.classList.add('collapsed');
    } else {
        content.style.display = 'block';
        toggle.textContent = '▼';
        banner.classList.remove('collapsed');
    }
}

// Initialize notice state when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeNoticeState);

class MemorialOverlay {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ribbonImage = document.getElementById('ribbonImage');
        this.ribbonOverlay = document.getElementById('ribbonOverlay');

        // State
        this.backgroundImage = null;
        this.ribbonImageData = null; // Store ribbon as data URL to avoid CORS issues
        this.ribbonData = {
            x: 15,
            y: 445, // Start near bottom (canvas default is 600px height)
            width: 60,
            height: 60,
            scale: 1.5 // Default size 1.5x larger for better visibility
        };
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.grayscaleEnabled = false;
        this.grayscaleIntensity = 100;

        // Load ribbon image as data URL to avoid CORS/taint issues
        this.loadRibbonAsDataURL();

        this.initializeEventListeners();
        this.updateCanvas();
        this.updateRibbonOverlayPosition(); // Initialize overlay position first
        this.updateRibbonDisplay();
    }

    async loadRibbonAsDataURL() {
        try {
            const response = await fetch('assets/black-ribbon-01.svg');
            const svgText = await response.text();
            const blob = new Blob([svgText], { type: 'image/svg+xml' });
            const reader = new FileReader();

            reader.onload = (e) => {
                this.ribbonImageData = e.target.result;
            };

            reader.readAsDataURL(blob);
        } catch (error) {
            console.error('Error loading ribbon image:', error);
        }
    }

    initializeEventListeners() {
        // Image upload
        document.getElementById('imageUpload').addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('clearImage').addEventListener('click', () => this.clearImage());

        // Ribbon controls
        document.getElementById('ribbonSize').addEventListener('input', (e) => this.updateRibbonSize(e.target.value));

        // Grayscale controls
        document.getElementById('grayscaleToggle').addEventListener('change', (e) => this.toggleGrayscale(e.target.checked));
        document.getElementById('grayscaleIntensity').addEventListener('input', (e) => this.updateGrayscaleIntensity(e.target.value));

        // Download
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());

        // Window resize
        window.addEventListener('resize', () => {
            // Update overlay position first, then ribbon display
            this.updateRibbonOverlayPosition();
            this.updateRibbonDisplay();
        });

        // Ribbon drag functionality
        this.ribbonImage.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());

        // Touch events for mobile
        this.ribbonImage.addEventListener('touchstart', (e) => this.startDrag(e));
        document.addEventListener('touchmove', (e) => this.drag(e));
        document.addEventListener('touchend', () => this.endDrag());

        // Mouse wheel for ribbon scaling
        this.ribbonImage.addEventListener('wheel', (e) => this.handleWheel(e));

        // Update value displays
        this.updateValueDisplays();
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check if it's an image file (including HEIC)
        const isValidImage = file.type.match('image.*') ||
                           file.name.toLowerCase().endsWith('.heic') ||
                           file.name.toLowerCase().endsWith('.heif');

        if (!isValidImage) {
            alert('Please select a valid image file (JPG, PNG, WebP, or HEIC)');
            return;
        }

        try {
            let imageBlob = file;

            // Convert HEIC/HEIF to JPEG if needed
            if (file.type === 'image/heic' || file.type === 'image/heif' ||
                file.name.toLowerCase().endsWith('.heic') ||
                file.name.toLowerCase().endsWith('.heif')) {

                console.log('Converting HEIC/HEIF to JPEG...');

                // Check if heic2any is available
                if (typeof heic2any === 'undefined') {
                    alert('HEIC files are not supported in this browser. Please convert to JPG or PNG first.');
                    return;
                }

                // Show loading message
                const loadingMsg = document.createElement('div');
                loadingMsg.id = 'heic-loading';
                loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:8px;z-index:9999;font-family:sans-serif;';
                loadingMsg.innerHTML = 'Converting HEIC image...<br><small>Please wait, this may take a moment.</small>';
                document.body.appendChild(loadingMsg);

                try {
                    // Convert HEIC to JPEG using heic2any library
                    imageBlob = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.9
                    });
                    console.log('HEIC conversion successful');
                } catch (heicError) {
                    console.error('HEIC conversion failed:', heicError);
                    alert('Failed to convert HEIC image. Please try converting to JPG or PNG first, or use a different image.');
                    return;
                } finally {
                    // Remove loading message
                    const loading = document.getElementById('heic-loading');
                    if (loading) loading.remove();
                }
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                // Set crossOrigin before setting src to avoid CORS issues
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    this.backgroundImage = img;
                    this.resizeCanvasToImage();
                    this.updateCanvas();
                    // Delay to ensure canvas is fully rendered
                    setTimeout(() => {
                        this.updateRibbonOverlayPosition();
                        this.updateRibbonDisplay();
                    }, 10);
                    document.getElementById('downloadBtn').disabled = false;
                };
                img.onerror = () => {
                    console.error('Failed to load converted image');
                    alert('Failed to load image. Please try again.');
                };
                img.src = e.target.result; // This is already a data URL, so no CORS issues
            };
            reader.readAsDataURL(imageBlob);

        } catch (error) {
            console.error('Error handling image upload:', error);
            alert('Error processing image. Please try again.');
        }
    }

    clearImage() {
        this.backgroundImage = null;
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.updateCanvas();
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('imageUpload').value = '';
    }

    resizeCanvasToImage() {
        if (!this.backgroundImage) return;

        // Use original image size - no downsizing
        const width = this.backgroundImage.width;
        const height = this.backgroundImage.height;

        this.canvas.width = width;
        this.canvas.height = height;

        // Reset ribbon position to bottom-left corner (in canvas coordinates)
        // Position will be automatically converted to display coordinates by updateRibbonDisplay
        const canvasMinDimension = Math.min(width, height);
        const responsiveBaseSize = canvasMinDimension * 0.15;
        const ribbonSize = this.ribbonData.scale * responsiveBaseSize;

        this.ribbonData.x = 20; // Left side with 20px margin
        this.ribbonData.y = Math.max(0, height - ribbonSize - 20); // Bottom with 20px margin

        this.updateRibbonDisplay();
    }

    updateCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.backgroundImage) {
            // Draw image first
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);

            // Apply grayscale filter if enabled using pixel manipulation (iOS compatible)
            if (this.grayscaleEnabled && this.grayscaleIntensity > 0) {
                this.applyGrayscaleFilter();
            }
        } else {
            // Draw placeholder
            this.ctx.fillStyle = '#fafafa';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.fillStyle = '#666';
            this.ctx.font = '20px Arial, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Upload an image to begin', this.canvas.width / 2, this.canvas.height / 2 - 15);

            this.ctx.fillStyle = '#888';
            this.ctx.font = '16px Arial, sans-serif';
            this.ctx.fillText('(อัปโหลดรูปภาพเพื่อเริ่มต้น)', this.canvas.width / 2, this.canvas.height / 2 + 15);
        }
    }

    applyGrayscaleFilter() {
        try {
            // Get image data
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
            const intensity = this.grayscaleIntensity / 100;

            // Process pixels
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Calculate grayscale value using luminosity method
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;

                // Blend original color with grayscale based on intensity
                data[i] = r + (gray - r) * intensity;     // Red
                data[i + 1] = g + (gray - g) * intensity; // Green
                data[i + 2] = b + (gray - b) * intensity; // Blue
                // Alpha channel (data[i + 3]) remains unchanged
            }

            // Put the modified image data back
            this.ctx.putImageData(imageData, 0, 0);
        } catch (error) {
            console.error('Error applying grayscale filter:', error);
            // Fallback to CSS filter method if pixel manipulation fails
            this.ctx.filter = `grayscale(${this.grayscaleIntensity}%)`;
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.filter = 'none';
        }
    }

    updateRibbonSize(value) {
        this.ribbonData.scale = value / 100;
        // Update display and constrain position after size change
        this.updateRibbonDisplay();
        document.getElementById('sizeValue').textContent = value + '%';
    }


    updateRibbonOverlayPosition() {
        // Position the ribbon overlay to match the canvas position exactly
        const canvasRect = this.canvas.getBoundingClientRect();
        const containerRect = this.canvas.parentElement.getBoundingClientRect();

        // Update ribbon overlay dimensions to match DISPLAYED canvas size (not internal resolution)
        this.ribbonOverlay.style.width = canvasRect.width + 'px';
        this.ribbonOverlay.style.height = canvasRect.height + 'px';

        this.ribbonOverlay.style.position = 'absolute';
        this.ribbonOverlay.style.left = (canvasRect.left - containerRect.left) + 'px';
        this.ribbonOverlay.style.top = (canvasRect.top - containerRect.top) + 'px';
        this.ribbonOverlay.style.pointerEvents = 'none';
        this.ribbonOverlay.style.zIndex = '10';
    }

    updateRibbonDisplay() {
        // Get the DISPLAYED canvas size (what user sees on screen)
        const canvasRect = this.canvas.getBoundingClientRect();
        const displayWidth = canvasRect.width;
        const displayHeight = canvasRect.height;

        // Calculate responsive base size based on DISPLAYED canvas dimensions
        const canvasMinDimension = Math.min(displayWidth, displayHeight);
        const responsiveBaseSize = canvasMinDimension * 0.15; // 15% of displayed canvas smaller dimension
        const size = this.ribbonData.scale * responsiveBaseSize;

        // Calculate scale ratio between displayed size and internal canvas size
        const scaleX = displayWidth / this.canvas.width;
        const scaleY = displayHeight / this.canvas.height;

        // Constrain ribbon position within DISPLAYED canvas bounds
        const maxX = displayWidth - size;
        const maxY = displayHeight - size;

        // Convert stored position (in canvas coordinates) to display coordinates
        const displayX = this.ribbonData.x * scaleX;
        const displayY = this.ribbonData.y * scaleY;

        // Constrain and convert back to canvas coordinates for storage
        const constrainedDisplayX = Math.max(0, Math.min(displayX, maxX));
        const constrainedDisplayY = Math.max(0, Math.min(displayY, maxY));

        this.ribbonData.x = constrainedDisplayX / scaleX;
        this.ribbonData.y = constrainedDisplayY / scaleY;

        // Apply styles using display coordinates
        this.ribbonImage.style.width = size + 'px';
        this.ribbonImage.style.height = size + 'px';
        this.ribbonImage.style.left = constrainedDisplayX + 'px';
        this.ribbonImage.style.top = constrainedDisplayY + 'px';
        this.ribbonImage.style.position = 'absolute';
        this.ribbonImage.style.pointerEvents = 'auto';
        this.ribbonImage.style.zIndex = '11';
    }

    toggleGrayscale(enabled) {
        this.grayscaleEnabled = enabled;
        const intensitySlider = document.getElementById('grayscaleIntensity');
        intensitySlider.disabled = !enabled;
        this.updateCanvas();
    }

    updateGrayscaleIntensity(value) {
        this.grayscaleIntensity = parseInt(value);
        document.getElementById('intensityValue').textContent = value + '%';
        this.updateCanvas();
    }

    startDrag(e) {
        e.preventDefault();
        this.isDragging = true;
        this.ribbonImage.classList.add('dragging');

        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        // Get current ribbon position in display coordinates
        const ribbonRect = this.ribbonImage.getBoundingClientRect();
        const overlayRect = this.ribbonOverlay.getBoundingClientRect();

        this.dragOffset.x = clientX - ribbonRect.left;
        this.dragOffset.y = clientY - ribbonRect.top;
    }

    drag(e) {
        if (!this.isDragging) return;

        e.preventDefault();
        const overlayRect = this.ribbonOverlay.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        // Calculate new position relative to overlay
        const newX = clientX - overlayRect.left - this.dragOffset.x;
        const newY = clientY - overlayRect.top - this.dragOffset.y;

        // Get displayed canvas size
        const canvasRect = this.canvas.getBoundingClientRect();
        const displayWidth = canvasRect.width;
        const displayHeight = canvasRect.height;

        // Calculate responsive ribbon size based on displayed size
        const canvasMinDimension = Math.min(displayWidth, displayHeight);
        const responsiveBaseSize = canvasMinDimension * 0.15;
        const ribbonSize = this.ribbonData.scale * responsiveBaseSize;

        // Constrain to displayed canvas bounds
        const maxX = displayWidth - ribbonSize;
        const maxY = displayHeight - ribbonSize;

        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        // Convert to canvas coordinates for storage
        const scaleX = displayWidth / this.canvas.width;
        const scaleY = displayHeight / this.canvas.height;

        this.ribbonData.x = constrainedX / scaleX;
        this.ribbonData.y = constrainedY / scaleY;

        this.updateRibbonDisplay();
    }

    endDrag() {
        this.isDragging = false;
        this.ribbonImage.classList.remove('dragging');
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5;
        const newScale = Math.max(0.1, Math.min(2, this.ribbonData.scale + delta / 100));
        this.ribbonData.scale = newScale;

        const sizeSlider = document.getElementById('ribbonSize');
        sizeSlider.value = Math.round(newScale * 100);
        this.updateRibbonSize(sizeSlider.value);

        // Ensure ribbon stays within bounds after resizing
        this.updateRibbonDisplay();
    }

    downloadImage() {
        if (!this.backgroundImage) {
            alert('กรุณาอัปโหลดรูปภาพก่อน / Please upload an image first');
            return;
        }

        if (!this.ribbonImageData) {
            alert('กรุณารอสักครู่ ระบบกำลังโหลดรูปโบว์ / Please wait, loading ribbon image...');
            return;
        }

        try {
            // Create a temporary canvas for the final image
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

            // Set canvas size to match the main canvas (full resolution)
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;

            // Draw background image first (no filter)
            tempCtx.drawImage(this.backgroundImage, 0, 0, tempCanvas.width, tempCanvas.height);

            // Apply grayscale using pixel manipulation (iOS compatible)
            if (this.grayscaleEnabled && this.grayscaleIntensity > 0) {
                try {
                    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const data = imageData.data;
                    const intensity = this.grayscaleIntensity / 100;

                    for (let i = 0; i < data.length; i += 4) {
                        // Calculate grayscale using luminosity method
                        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

                        // Blend original color with grayscale based on intensity
                        data[i] = data[i] * (1 - intensity) + gray * intensity;     // R
                        data[i + 1] = data[i + 1] * (1 - intensity) + gray * intensity; // G
                        data[i + 2] = data[i + 2] * (1 - intensity) + gray * intensity; // B
                        // Alpha channel (i + 3) remains unchanged
                    }

                    tempCtx.putImageData(imageData, 0, 0);
                } catch (pixelError) {
                    console.warn('Pixel manipulation failed, using filter fallback:', pixelError);
                    // Fallback to filter method if pixel manipulation fails
                    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                    tempCtx.filter = `grayscale(${this.grayscaleIntensity}%)`;
                    tempCtx.drawImage(this.backgroundImage, 0, 0, tempCanvas.width, tempCanvas.height);
                    tempCtx.filter = 'none';
                }
            }

            // Calculate ribbon size based on canvas dimensions
            const canvasMinDimension = Math.min(tempCanvas.width, tempCanvas.height);
            const responsiveBaseSize = canvasMinDimension * 0.15;
            const actualRibbonSize = this.ribbonData.scale * responsiveBaseSize;

            // Use ribbon position in canvas coordinates (stored in ribbonData)
            const ribbonX = this.ribbonData.x;
            const ribbonY = this.ribbonData.y;

            // Load ribbon from data URL and draw
            const ribbonImg = new Image();
            ribbonImg.onload = () => {
                // Draw ribbon overlay
                tempCtx.save();
                tempCtx.translate(ribbonX + (actualRibbonSize / 2), ribbonY + (actualRibbonSize / 2));
                const scaleRatio = actualRibbonSize / 120; // 120 is the base SVG size
                tempCtx.scale(scaleRatio, scaleRatio);
                tempCtx.drawImage(ribbonImg, -60, -60, 120, 120);
                tempCtx.restore();

                // Convert to blob for download
                tempCanvas.toBlob((blob) => {
                    if (blob) {
                        // Use Blob for download (better for large files)
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                        link.download = `memorial-${timestamp}.png`;
                        link.href = url;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);

                        // Cleanup
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                    } else {
                        throw new Error('Failed to create blob from canvas');
                    }
                }, 'image/png');
            };

            ribbonImg.onerror = () => {
                throw new Error('Failed to load ribbon image for download');
            };

            // Use the pre-loaded data URL (no CORS issues)
            ribbonImg.src = this.ribbonImageData;

        } catch (error) {
            console.error('Error downloading image:', error);
            alert('ไม่สามารถดาวน์โหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง\nError downloading image. Please try again.\n\n' + error.message);
        }
    }

    updateValueDisplays() {
        document.getElementById('sizeValue').textContent = Math.round(this.ribbonData.scale * 100) + '%';
        document.getElementById('intensityValue').textContent = this.grayscaleIntensity + '%';
    }
}

// Console signature - For developers who inspect the code
console.log('%c╔═══════════════════════════════════════════════════════════════════╗', 'color: #2c2c2c; font-weight: bold;');
console.log('%c║      Black Ribbon Memorial Overlay - Web Application              ║', 'color: #2c2c2c; font-weight: bold;');
console.log('%c║                  Powered by Priesdelly                            ║', 'color: #2c2c2c; font-weight: bold;');
console.log('%c║              © 2025 - github.com/priesdelly                       ║', 'color: #2c2c2c; font-weight: bold;');
console.log('%c╠═══════════════════════════════════════════════════════════════════╣', 'color: #2c2c2c; font-weight: bold;');
console.log('%c║                                                                   ║', 'color: #666;');
console.log('%c║  Thank you for using this tool respectfully 🕯️                    ║', 'color: #666;');
console.log('%c║  All processing happens locally - Your privacy is protected       ║', 'color: #666;');
console.log('%c║                                                                   ║', 'color: #666;');
console.log('%c║  If you find this useful, consider:                               ║', 'color: #888;');
console.log('%c║  • Giving credit when sharing                                     ║', 'color: #888;');
console.log('%c║  • Contributing to the project on GitHub                          ║', 'color: #888;');
console.log('%c║  • Sharing with others who might need it                          ║', 'color: #888;');
console.log('%c║                                                                   ║', 'color: #666;');
console.log('%c║  Created with love and respect for those we remember              ║', 'color: #666;');
console.log('%c╚═══════════════════════════════════════════════════════════════════╝', 'color: #2c2c2c; font-weight: bold;');
console.log('%c\n👨‍💻 Developer Info:', 'color: #2c2c2c; font-weight: bold; font-size: 14px;');
console.log('%c   GitHub: https://github.com/priesdelly', 'color: #4a4a4a;');
console.log('%c   Project: Black Ribbon Memorial Overlay', 'color: #4a4a4a;');
console.log('%c   Built: October 2025\n', 'color: #4a4a4a;');

// Cookie Consent Management
class CookieConsent {
    constructor() {
        this.cookieConsent = document.getElementById('cookieConsent');
        this.acceptBtn = document.getElementById('acceptCookies');

        this.init();
    }

    init() {
        // Check if user has already accepted cookies
        if (!localStorage.getItem('cookieConsent')) {
            this.showConsent();
        } else {
            this.loadGoogleAnalytics();
        }

        // Handle accept button click
        this.acceptBtn.addEventListener('click', () => {
            this.acceptCookies();
        });
    }

    showConsent() {
        this.cookieConsent.classList.add('show');
    }

    hideConsent() {
        this.cookieConsent.classList.remove('show');
    }

    acceptCookies() {
        localStorage.setItem('cookieConsent', 'accepted');
        this.hideConsent();
        this.loadGoogleAnalytics();
    }

    loadGoogleAnalytics() {

        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-QY0L4VQEEK');

        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-QY0L4VQEEK';

        document.head.appendChild(script);

        console.log('Google Analytics would be loaded here');
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MemorialOverlay();
    new CookieConsent();
});
