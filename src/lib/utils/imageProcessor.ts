/**
 * Preprocesses an image for better OCR accuracy.
 * Steps:
 * 1. Resizes image to a reasonable width (e.g., 1800px) to ensure sufficient DPI but efficient processing.
 * 2. Converts to Grayscale.
 * 3. Increases Contrast.
 * 4. Applies a simple binarization (thresholding) to make text stand out.
 */
export async function preprocessImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            // 1. Resize logic: Target width around 1500-2000px for good OCR speed/accuracy balance
            // KBank slips are usually tall.
            let width = img.width;
            let height = img.height;
            const TARGET_WIDTH = 1800;

            if (width > TARGET_WIDTH) {
                const ratio = TARGET_WIDTH / width;
                width = TARGET_WIDTH;
                height = img.height * ratio;
            }

            canvas.width = width;
            canvas.height = height;

            // Draw original image
            ctx.drawImage(img, 0, 0, width, height);

            // Get raw pixel data
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // 2. Grayscale & Calculate Histogram
            const histogram = new Array(256).fill(0);

            // First pass: Convert to grayscale and build histogram
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Standard Grayscale: 0.299R + 0.587G + 0.114B
                let gray = 0.299 * r + 0.587 * g + 0.114 * b;

                // Store temporarily in R channel to avoid re-calculating
                data[i] = gray;

                histogram[Math.floor(gray)]++;
            }

            // 3. Find Background Peak (Adaptive Thresholding)
            // Look for the most frequent brightness value in the upper half (128-255)
            // assuming the background is relatively light.
            let maxCount = 0;
            let backgroundPeak = 255; // Default to white

            for (let i = 128; i < 256; i++) {
                if (histogram[i] > maxCount) {
                    maxCount = histogram[i];
                    backgroundPeak = i;
                }
            }

            // Calculate dynamic threshold
            // Background peak is our reference for "white/background color".
            // OFFSET should be carefully chosen. Too small = background noise stays. Too large = light text disappears.
            // 25 seems like a safer middle ground for textured backgrounds.
            const THRESHOLD_OFFSET = 25;
            const threshold = Math.max(100, backgroundPeak - THRESHOLD_OFFSET);

            console.log(`[OCR Preprocessing] Background Peak: ${backgroundPeak}, Dynamic Threshold: ${threshold}`);

            // 4. Contrast & Binary Thresholding using Dynamic Threshold
            for (let i = 0; i < data.length; i += 4) {
                // Retrieve pre-calculated gray from R channel
                let gray = data[i];

                // Increase Contrast significantly to push text towards black and background towards white
                // Factor formula: factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
                const contrast = 60; // Increased from 30 for better separation
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                gray = factor * (gray - 128) + 128;

                // Clamp
                gray = Math.max(0, Math.min(255, gray));

                // Apply Dynamic Threshold
                if (gray > threshold) {
                    gray = 255;
                } else {
                    // Force text to be very dark to help Tesseract
                    gray = Math.max(0, gray - 40); // More aggressive darkening
                }

                data[i] = gray;     // R
                data[i + 1] = gray; // G
                data[i + 2] = gray; // B
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => reject(err);
        img.src = URL.createObjectURL(file);
    });
}
