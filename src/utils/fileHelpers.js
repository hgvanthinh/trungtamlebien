/**
 * Format file size to human-readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted string (e.g., "5.2 MB", "1.3 GB")
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get file extension from filename
 * @param {string} fileName - Full filename with extension
 * @returns {string} - Extension (lowercase, without dot)
 */
export const getFileExtension = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return '';
  return fileName.split('.').pop().toLowerCase();
};

/**
 * Validate file type against allowed types
 * @param {File} file - File object to validate
 * @param {string[]} allowedTypes - Array of allowed MIME types
 * @returns {boolean} - True if file type is valid
 */
export const validateFileType = (file, allowedTypes) => {
  if (!file || !allowedTypes || !Array.isArray(allowedTypes)) return false;

  const extension = getFileExtension(file.name);
  const type = file.type.toLowerCase();

  // Check MIME type
  if (allowedTypes.includes(type)) return true;

  // Check extension (fallback for cases where MIME type is missing/wrong)
  const extensionMap = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return allowedTypes.includes(extensionMap[extension]);
};

/**
 * Check if file is an image
 * @param {File} file - File to check
 * @returns {boolean} - True if file is an image
 */
export const isImageFile = (file) => {
  if (!file) return false;
  const type = file.type.toLowerCase();
  const extension = getFileExtension(file.name);
  return type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension);
};

/**
 * Check if file is a PDF
 * @param {File} file - File to check
 * @returns {boolean} - True if file is a PDF
 */
export const isPDFFile = (file) => {
  if (!file) return false;
  const type = file.type.toLowerCase();
  const extension = getFileExtension(file.name);
  return type.includes('pdf') || extension === 'pdf';
};

/**
 * Check if file is a Word document
 * @param {File} file - File to check
 * @returns {boolean} - True if file is DOC/DOCX
 */
export const isWordFile = (file) => {
  if (!file) return false;
  const type = file.type.toLowerCase();
  const extension = getFileExtension(file.name);
  return (
    type.includes('wordprocessingml') ||
    type.includes('msword') ||
    ['doc', 'docx'].includes(extension)
  );
};
