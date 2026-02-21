import imageCompression from 'browser-image-compression';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import html2pdf from 'html2pdf.js';

// Constants
const IMAGE_QUALITY = 0.65; // 65% quality (60-70% range)
const MAX_PROCESSED_SIZE_MB = 10;

/**
 * Main router function - processes any file type
 * @param {File} file - File to process
 * @param {Function} onProgress - Progress callback ({ stage, progress })
 * @returns {Promise<Object>} - { file, originalSize, processedSize, compressionRatio, converted?, originalType? }
 */
export const processFileForExam = async (file, onProgress) => {
  const fileType = getFileType(file);

  try {
    switch (fileType) {
      case 'image':
        return await compressImageForExam(file, onProgress);
      case 'pdf':
        return await compressPDF(file, onProgress);
      case 'docx':
        return await convertDocxToPDF(file, onProgress);
      default:
        throw new Error(`Loại file không được hỗ trợ: ${file.type}`);
    }
  } catch (error) {
    console.error('File processing error:', error);
    throw error;
  }
};

/**
 * Compress image for exam (quality 60-70%, max 10MB)
 * @param {File} file - Image file
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Processing result
 */
export const compressImageForExam = async (file, onProgress) => {
  // 1. Validate file size < 50MB (original)
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File gốc không được vượt quá 50MB');
  }

  onProgress?.({ stage: 'compressing', progress: 0 });

  // 2. Configure compression options
  const options = {
    maxSizeMB: MAX_PROCESSED_SIZE_MB,
    maxWidthOrHeight: 2400, // Higher quality than avatar (1200px)
    useWebWorker: true,
    initialQuality: IMAGE_QUALITY,
    onProgress: (progress) => {
      onProgress?.({ stage: 'compressing', progress: Math.round(progress) });
    },
  };

  try {
    // 3. Compress image
    const compressedFile = await imageCompression(file, options);

    // 4. Verify result < 10MB
    if (compressedFile.size > MAX_PROCESSED_SIZE_MB * 1024 * 1024) {
      throw new Error('Không thể nén ảnh xuống dưới 10MB. Vui lòng chọn ảnh khác hoặc nén thủ công trước khi upload.');
    }

    onProgress?.({ stage: 'compressing', progress: 100 });

    // 5. Return result
    return {
      file: compressedFile,
      originalSize: file.size,
      processedSize: compressedFile.size,
      compressionRatio: ((1 - compressedFile.size / file.size) * 100).toFixed(1),
    };
  } catch (error) {
    throw new Error(`Lỗi nén ảnh: ${error.message}`);
  }
};

/**
 * Process PDF (validate size and optionally compress using pdf-lib)
 * @param {File} file - PDF file
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Processing result
 */
export const compressPDF = async (file, onProgress) => {
  // 1. Validate file size < 50MB (original)
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File PDF gốc không được vượt quá 50MB');
  }

  onProgress?.({ stage: 'compressing', progress: 20 });

  try {
    // 2. Load PDF with pdf-lib
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    onProgress?.({ stage: 'compressing', progress: 50 });

    // 3. Save with optimization
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true, // Compress internal structure
      addDefaultPage: false,
    });

    onProgress?.({ stage: 'compressing', progress: 80 });

    // 4. Create new File from compressed bytes
    const compressedFile = new File([pdfBytes], file.name, {
      type: 'application/pdf',
    });

    // 5. Check if result is under 10MB
    if (compressedFile.size > MAX_PROCESSED_SIZE_MB * 1024 * 1024) {
      throw new Error('File PDF quá lớn (> 10MB). Vui lòng nén file bằng công cụ bên ngoài trước khi upload.');
    }

    onProgress?.({ stage: 'compressing', progress: 100 });

    // 6. Return result
    const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1);

    return {
      file: compressedFile,
      originalSize: file.size,
      processedSize: compressedFile.size,
      compressionRatio: compressionRatio > 0 ? compressionRatio : '0',
    };
  } catch (error) {
    // If PDF is already small enough, just return it as-is
    if (file.size <= MAX_PROCESSED_SIZE_MB * 1024 * 1024) {
      onProgress?.({ stage: 'compressing', progress: 100 });
      return {
        file: file,
        originalSize: file.size,
        processedSize: file.size,
        compressionRatio: '0',
      };
    }
    throw new Error(`Lỗi xử lý PDF: ${error.message}`);
  }
};

/**
 * Convert DOCX to PDF (two-step: DOCX → HTML → PDF, then compress)
 * @param {File} file - DOCX file
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Processing result
 */
export const convertDocxToPDF = async (file, onProgress) => {
  // 1. Validate file size < 50MB (original)
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File DOCX gốc không được vượt quá 50MB');
  }

  try {
    // 2. Stage 1: DOCX → HTML (using mammoth.js)
    onProgress?.({ stage: 'converting', progress: 20 });

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;

    // Log warnings if any
    if (result.messages.length > 0) {
      console.warn('Mammoth conversion warnings:', result.messages);
    }

    onProgress?.({ stage: 'converting', progress: 50 });

    // 3. Stage 2: HTML → PDF (using html2pdf.js)
    const pdfBlob = await html2pdf()
      .from(html)
      .set({
        margin: 1,
        filename: file.name.replace(/\.(docx|doc)$/i, '.pdf'),
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      })
      .outputPdf('blob');

    onProgress?.({ stage: 'converting', progress: 80 });

    // 4. Stage 3: Compress the generated PDF
    const compressedResult = await compressPDF(
      new File([pdfBlob], file.name.replace(/\.(docx|doc)$/i, '.pdf'), {
        type: 'application/pdf',
      }),
      (subProgress) => {
        // Map PDF compression progress from 80% to 100%
        onProgress?.({
          stage: 'compressing',
          progress: Math.round(80 + subProgress.progress * 0.2),
        });
      }
    );

    onProgress?.({ stage: 'complete', progress: 100 });

    // 5. Return result with conversion metadata
    return {
      ...compressedResult,
      converted: true,
      originalType: file.type,
    };
  } catch (error) {
    throw new Error(`Lỗi chuyển đổi DOCX sang PDF: ${error.message}`);
  }
};

/**
 * Estimate processing time (in seconds)
 * @param {File} file - File to estimate
 * @returns {number} - Estimated time in seconds
 */
export const estimateProcessingTime = (file) => {
  const sizeMB = file.size / (1024 * 1024);
  const fileType = getFileType(file);

  const estimates = {
    image: Math.ceil(sizeMB * 0.3), // ~0.3s per MB
    pdf: Math.ceil(sizeMB * 1.5), // ~1.5s per MB
    docx: Math.ceil(sizeMB * 3), // ~3s per MB (conversion + compression)
  };

  return estimates[fileType] || 10;
};

/**
 * Detect file type based on MIME type and extension
 * @param {File} file - File to detect
 * @returns {string} - 'image', 'pdf', 'docx', or 'unknown'
 */
const getFileType = (file) => {
  const type = file.type.toLowerCase();
  const extension = file.name.split('.').pop().toLowerCase();

  if (type.includes('image') || ['jpg', 'jpeg', 'png'].includes(extension)) {
    return 'image';
  }
  if (type.includes('pdf') || extension === 'pdf') {
    return 'pdf';
  }
  if (
    type.includes('wordprocessingml') ||
    type.includes('msword') ||
    ['doc', 'docx'].includes(extension)
  ) {
    return 'docx';
  }
  return 'unknown';
};
