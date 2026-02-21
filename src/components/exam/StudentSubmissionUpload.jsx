import { useState } from 'react';
import { processFileForExam, estimateProcessingTime } from '../../services/fileProcessingService';
import { uploadFile } from '../../services/storageService';
import Button from '../common/Button';
import Icon from '../common/Icon';
import FileProcessingProgress from './FileProcessingProgress';
import { validateFileType } from '../../utils/fileHelpers';

const StudentSubmissionUpload = ({ examId, studentUid, onUploadComplete, onCancel }) => {
  const [files, setFiles] = useState([]); // Mảng các file đã chọn
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processProgress, setProcessProgress] = useState(null);
  const [error, setError] = useState('');

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setError('');

    // Validate file types
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];

    const invalidFiles = selectedFiles.filter(file => !validateFileType(file, allowedTypes));
    if (invalidFiles.length > 0) {
      setError('Chỉ chấp nhận file ảnh JPG, PNG');
      return;
    }

    // Check file sizes (max 50MB per file)
    const oversizedFiles = selectedFiles.filter(file => file.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError('Mỗi file không được vượt quá 50MB');
      return;
    }

    // Thêm file mới vào danh sách
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    try {
      setProcessing(true);
      setError('');

      const uploadedFiles = [];
      let totalOriginalSize = 0;
      let totalProcessedSize = 0;

      // Process and upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const estimatedTime = estimateProcessingTime(file);

        // Update progress
        setProcessProgress({
          stage: 'processing',
          progress: Math.round((i / files.length) * 50),
          estimatedTime,
          currentFile: i + 1,
          totalFiles: files.length
        });

        // Process file (compress/convert)
        const processedResult = await processFileForExam(file, (progress) => {
          setProcessProgress({
            ...progress,
            estimatedTime,
            currentFile: i + 1,
            totalFiles: files.length
          });
        });

        totalOriginalSize += processedResult.originalSize;
        totalProcessedSize += processedResult.processedSize;

        // Upload processed file
        setProcessProgress({
          stage: 'uploading',
          progress: Math.round(50 + (i / files.length) * 50),
          currentFile: i + 1,
          totalFiles: files.length
        });

        const uploadResult = await uploadFile('student-submissions', processedResult.file, (progress) => {
          const uploadProgress = 50 + ((i + progress / 100) / files.length) * 50;
          setProcessProgress({
            stage: 'uploading',
            progress: Math.round(uploadProgress),
            currentFile: i + 1,
            totalFiles: files.length
          });
        });

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Lỗi upload file');
        }

        uploadedFiles.push({
          fileUrl: uploadResult.url,
          fileName: file.name,
          fileType: 'image',
          originalSize: processedResult.originalSize,
          processedSize: processedResult.processedSize,
        });
      }

      setProcessing(false);
      setUploading(false);
      setProcessProgress({ stage: 'complete', progress: 100 });

      // Calculate overall compression ratio
      const compressionRatio = totalOriginalSize > 0
        ? Math.round((1 - totalProcessedSize / totalOriginalSize) * 100)
        : 0;

      // Build file data object with array of files
      const fileData = {
        files: uploadedFiles, // Mảng các file đã upload
        totalFiles: uploadedFiles.length,
        fileType: 'image',
        originalSize: totalOriginalSize,
        processedSize: totalProcessedSize,
        compressionRatio: compressionRatio,
        uploadedAt: new Date(),
      };

      onUploadComplete(fileData);

    } catch (err) {
      console.error('Upload error:', err);

      // User-friendly error messages
      let errorMsg = 'Lỗi không xác định';
      if (err.message.includes('quá lớn')) {
        errorMsg = err.message;
      } else if (err.message.includes('nén')) {
        errorMsg = 'Không thể nén file. Vui lòng thử file khác hoặc nén thủ công trước khi upload.';
      } else if (err.message.includes('network') || err.message.includes('upload')) {
        errorMsg = 'Lỗi kết nối. Vui lòng kiểm tra internet và thử lại.';
      } else {
        errorMsg = err.message;
      }

      setError(errorMsg);
      setProcessing(false);
      setUploading(false);
      setProcessProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Icon name="upload" className="text-primary" />
        Nộp bài làm
      </h3>

      {!processing && !uploading ? (
        <>
          {/* Mobile-optimized File Input */}
          <div className="space-y-3">
            {/* Camera Capture Button (Mobile Priority) - Multiple photos */}
            <input
              type="file"
              id="submission-camera"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor="submission-camera"
              className="block w-full cursor-pointer"
            >
              <div className="bg-gradient-to-r from-blue-500 to-primary text-white rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition transform active:scale-95">
                <Icon name="photo_camera" className="text-5xl mb-3" />
                <p className="font-bold text-lg mb-1">📸 Chụp nhiều ảnh bài làm</p>
                <p className="text-sm opacity-90">Chụp từng trang bài làm</p>
              </div>
            </label>

            {/* File Upload Button (Secondary) - Multiple files */}
            <input
              type="file"
              id="submission-file"
              accept="image/jpeg,image/jpg,image/png"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor="submission-file"
              className="block w-full cursor-pointer"
            >
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition active:scale-95">
                <Icon name="folder_open" className="text-4xl text-gray-400 mb-2" />
                <p className="text-sm font-medium mb-1">
                  📁 Chọn nhiều ảnh từ thiết bị
                </p>
                <p className="text-xs text-gray-500">
                  JPG, PNG (max 50MB/ảnh)
                </p>
              </div>
            </label>
          </div>

          {/* Info Badges */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
            <div className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200">
              <Icon name="info" className="text-sm mt-0.5 flex-shrink-0" />
              <span>Có thể chọn nhiều ảnh cùng lúc. Hệ thống tự động nén xuống dưới 10MB</span>
            </div>
          </div>

          {/* Selected Files Preview */}
          {files.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl p-4">
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="check_circle" className="text-green-500 text-xl" />
                  <p className="font-bold text-sm text-green-800 dark:text-green-200">
                    Đã chọn {files.length} ảnh
                  </p>
                </div>
                <p className="text-xs text-green-600 dark:text-green-300">
                  📦 Tổng: {(files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>

              {/* List of files */}
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Icon name="image" className="text-green-500 text-sm flex-shrink-0" />
                      <span className="text-xs text-green-800 dark:text-green-200 truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-green-600 dark:text-green-300 whitespace-nowrap">
                        {(file.size / (1024 * 1024)).toFixed(1)}MB
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded flex-shrink-0"
                      aria-label="Xóa ảnh"
                    >
                      <Icon name="close" className="text-red-500 text-sm" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Upload Button - Large & Clear */}
              <Button
                variant="primary"
                onClick={handleUpload}
                className="w-full py-4 text-lg font-bold shadow-lg"
              >
                <Icon name="cloud_upload" className="mr-2 text-xl" />
                🚀 Xử lý & Nộp {files.length} ảnh
              </Button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <Icon name="error" className="text-xl flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm mb-1">⚠️ Lỗi</p>
                  <p className="text-xs">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Cancel Button - Only show when no file selected */}
          {files.length === 0 && (
            <Button
              variant="secondary"
              onClick={onCancel}
              className="w-full"
            >
              <Icon name="arrow_back" className="mr-2" />
              Quay lại
            </Button>
          )}
        </>
      ) : (
        <>
          {/* Processing Progress */}
          <FileProcessingProgress
            stage={processProgress?.stage || 'preparing'}
            progress={processProgress?.progress || 0}
            estimatedTime={processProgress?.estimatedTime}
            currentFile={processProgress?.currentFile}
            totalFiles={processProgress?.totalFiles}
            onCancel={() => {
              if (confirm('Đang xử lý file. Bạn có chắc muốn hủy?')) {
                setProcessing(false);
                setUploading(false);
                setProcessProgress(null);
              }
            }}
          />
        </>
      )}
    </div>
  );
};

export default StudentSubmissionUpload;
