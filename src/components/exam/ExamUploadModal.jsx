import { useState } from 'react';
import { uploadExamFile, updateUploadExam } from '../../services/examBankService';
import { processFileForExam, estimateProcessingTime } from '../../services/fileProcessingService';
import Button from '../common/Button';
import Icon from '../common/Icon';
import FileProcessingProgress from './FileProcessingProgress';

const ExamUploadModal = ({ currentUser, onClose, onComplete, editingExam }) => {
  const [title, setTitle] = useState(editingExam?.title || '');
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processProgress, setProcessProgress] = useState(null);

  const isEditMode = !!editingExam;

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validate file type (expanded to include DOC/DOCX)
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/msword', // DOC
    ];

    const validExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
    const extension = selectedFile.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(extension)) {
      alert('Chỉ hỗ trợ file PDF, ảnh (JPG, PNG) hoặc Word (DOC, DOCX)');
      return;
    }

    // Validate file size (50MB original)
    if (selectedFile.size > 50 * 1024 * 1024) {
      alert('File không được vượt quá 50MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!isEditMode && !title.trim()) {
      alert('Vui lòng nhập tên đề thi');
      return;
    }

    if (!file) {
      alert('Vui lòng chọn file');
      return;
    }

    try {
      // Step 1: Process file (compress/convert)
      setProcessing(true);
      const estimatedTime = estimateProcessingTime(file);

      setProcessProgress({
        stage: 'preparing',
        progress: 0,
        estimatedTime,
      });

      const processedResult = await processFileForExam(file, (progress) => {
        setProcessProgress({
          ...progress,
          estimatedTime,
        });
      });

      // Step 2: Upload processed file
      setProcessing(false);
      setUploading(true);
      setProcessProgress({
        stage: 'uploading',
        progress: 0,
      });

      let result;
      if (isEditMode) {
        // Update existing exam
        result = await updateUploadExam(
          editingExam.id,
          processedResult.file,
          {
            originalSize: processedResult.originalSize,
            processedSize: processedResult.processedSize,
            compressionRatio: processedResult.compressionRatio,
            converted: processedResult.converted || false,
            originalType: processedResult.originalType,
          }
        );
      } else {
        // Create new exam
        result = await uploadExamFile(
          processedResult.file,
          title,
          currentUser.uid,
          {
            originalSize: processedResult.originalSize,
            processedSize: processedResult.processedSize,
            compressionRatio: processedResult.compressionRatio,
            converted: processedResult.converted || false,
            originalType: processedResult.originalType,
          }
        );
      }

      setUploading(false);
      setProcessProgress(null);

      if (result.success) {
        onComplete({
          ...result,
          message: isEditMode
            ? `Cập nhật thành công! Giảm ${processedResult.compressionRatio}% dung lượng.`
            : `Upload thành công! Giảm ${processedResult.compressionRatio}% dung lượng.`,
        });
      } else {
        alert(isEditMode ? 'Cập nhật thất bại: ' + result.error : 'Upload thất bại: ' + result.error);
      }
    } catch (error) {
      setProcessing(false);
      setUploading(false);
      setProcessProgress(null);

      // User-friendly error messages
      if (error.message.includes('10MB')) {
        alert(
          'File quá lớn sau khi nén. Vui lòng chọn file nhỏ hơn hoặc nén thủ công trước khi upload.'
        );
      } else if (error.message.includes('DOCX')) {
        alert(
          'Lỗi chuyển đổi DOCX. Vui lòng lưu file dưới dạng PDF từ Microsoft Word và thử lại.'
        );
      } else {
        alert('Lỗi xử lý file: ' + error.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {isEditMode ? 'Sửa đề thi' : 'Upload đề thi'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Show progress if processing/uploading */}
        {processing || uploading ? (
          <FileProcessingProgress
            stage={processProgress?.stage || 'preparing'}
            progress={processProgress?.progress || 0}
            estimatedTime={processProgress?.estimatedTime}
            onCancel={() => {
              if (confirm('Đang xử lý file. Bạn có chắc muốn hủy?')) {
                onClose();
              }
            }}
          />
        ) : (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Tên đề thi <span className="text-red-500">*</span>
                {isEditMode && <span className="text-xs text-gray-500 ml-2">(Không thể sửa)</span>}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Đề kiểm tra Toán học kỳ 1"
                className="clay-input w-full px-4 py-3 rounded-xl"
                disabled={isEditMode}
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {isEditMode ? 'Upload lại file' : 'Chọn file'} <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                id="exam-file-input"
              />
              <label
                htmlFor="exam-file-input"
                className="flex items-center justify-center gap-2 clay-input w-full px-4 py-8 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <Icon name="upload_file" className="text-3xl text-gray-400" />
                <div className="text-center">
                  {file ? (
                    <>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Click để chọn file</p>
                      <p className="text-xs text-gray-500">PDF, JPG, PNG, DOC, DOCX (max 50MB)</p>
                      <p className="text-xs text-primary mt-1">Sẽ tự động nén xuống dưới 10MB</p>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Actions */}
        {!processing && !uploading && (
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!file || (!isEditMode && !title.trim())}
              className="flex-1"
            >
              {isEditMode ? 'Cập nhật đề' : 'Xử lý & Upload'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamUploadModal;
