import { useState } from 'react';
import { uploadExamFile } from '../../services/examBankService';
import { processFileForExam, estimateProcessingTime } from '../../services/fileProcessingService';
import { createMultipleChoiceExam, updateMultipleChoiceExam } from '../../services/examBankService';
import Button from '../common/Button';
import Icon from '../common/Icon';
import FileProcessingProgress from './FileProcessingProgress';

const ExamMultipleChoiceModal = ({ currentUser, onClose, onComplete, editingExam }) => {
  const [title, setTitle] = useState(editingExam?.title || '');
  const [file, setFile] = useState(null);
  const [answerKey, setAnswerKey] = useState('');
  const [totalQuestions, setTotalQuestions] = useState('');
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processProgress, setProcessProgress] = useState(null);
  const [error, setError] = useState('');

  const isEditMode = !!editingExam;

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    const validExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
    const extension = selectedFile.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(extension)) {
      setError('Chi ho tro file PDF, anh (JPG, PNG) hoac Word (DOC, DOCX)');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File khong duoc vuot qua 50MB');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  // Parse answer key from input like "1.A 2.B 3.C" or "1A 2B 3C" or "1-A, 2-B, 3-C"
  const parseAnswerKey = (input) => {
    const answers = {};
    // Match patterns: "1.A", "1A", "1-A", "1:A", "Câu 1: A", etc.
    const regex = /(?:c[aâ]u\s*)?(\d+)\s*[.:)\-]?\s*([A-Da-d])/gi;
    let match;

    while ((match = regex.exec(input)) !== null) {
      const questionNum = parseInt(match[1]);
      const answer = match[2].toUpperCase();
      answers[questionNum] = answer;
    }

    return answers;
  };

  const validateAnswerKey = () => {
    if (!answerKey.trim()) {
      return { valid: false, error: 'Vui lòng nhập đáp án' };
    }

    const parsed = parseAnswerKey(answerKey);
    const count = Object.keys(parsed).length;

    if (count === 0) {
      return { valid: false, error: 'Không tìm thấy đáp án hợp lệ. Ví dụ: 1.A 2.B 3.C' };
    }

    // Check if totalQuestions matches
    if (totalQuestions && parseInt(totalQuestions) !== count) {
      return {
        valid: false,
        error: `Số câu nhập (${totalQuestions}) không khớp với đáp án (${count} câu)`,
      };
    }

    return { valid: true, parsed, count };
  };

  const handleUpload = async () => {
    setError('');

    if (!isEditMode && !title.trim()) {
      setError('Vui lòng nhập tên đề thi');
      return;
    }

    if (!file && !isEditMode) {
      setError('Vui lòng chọn file đề thi');
      return;
    }

    const validation = validateAnswerKey();
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    try {
      // Step 1: Process file if provided
      let processedResult = null;
      if (file) {
        setProcessing(true);
        const estimatedTime = estimateProcessingTime(file);

        setProcessProgress({
          stage: 'preparing',
          progress: 0,
          estimatedTime,
        });

        processedResult = await processFileForExam(file, (progress) => {
          setProcessProgress({
            ...progress,
            estimatedTime,
          });
        });
      }

      // Step 2: Upload/Update exam
      setProcessing(false);
      setUploading(true);
      setProcessProgress({
        stage: 'uploading',
        progress: 0,
      });

      let result;
      if (isEditMode) {
        // Update existing exam
        result = await updateMultipleChoiceExam(
          editingExam.id,
          processedResult?.file || null,
          processedResult ? {
            originalSize: processedResult.originalSize,
            processedSize: processedResult.processedSize,
            compressionRatio: processedResult.compressionRatio,
            converted: processedResult.converted || false,
            originalType: processedResult.originalType,
          } : {},
          validation.parsed,
          validation.count
        );
      } else {
        // Create new exam
        result = await createMultipleChoiceExam(
          processedResult.file,
          title,
          currentUser.uid,
          {
            originalSize: processedResult.originalSize,
            processedSize: processedResult.processedSize,
            compressionRatio: processedResult.compressionRatio,
            converted: processedResult.converted || false,
            originalType: processedResult.originalType,
          },
          validation.parsed,
          validation.count
        );
      }

      setUploading(false);
      setProcessProgress(null);

      if (result.success) {
        onComplete({
          ...result,
          message: isEditMode
            ? `Cập nhật đề thành công! ${validation.count} câu hỏi.`
            : `Tạo đề trắc nghiệm thành công! ${validation.count} câu hỏi.`,
        });
      } else {
        setError((isEditMode ? 'Cập nhật' : 'Tạo') + ' đề thất bại: ' + result.error);
      }
    } catch (error) {
      setProcessing(false);
      setUploading(false);
      setProcessProgress(null);
      setError('Lỗi: ' + error.message);
    }
  };

  const previewAnswers = parseAnswerKey(answerKey);
  const previewCount = Object.keys(previewAnswers).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-[#111812] dark:text-white">
            {isEditMode ? 'Sửa đề trắc nghiệm' : 'Tạo đề trắc nghiệm'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Content */}
        {processing || uploading ? (
          <div className="p-6">
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
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left - File upload */}
              <div className="space-y-4">
                <h3 className="font-bold text-[#111812] dark:text-white flex items-center gap-2">
                  <Icon name="upload_file" className="text-primary" />
                  Đề thi
                </h3>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#111812] dark:text-white">
                    Tên đề thi <span className="text-red-500">*</span>
                    {isEditMode && <span className="text-xs text-gray-500 ml-2">(Không thể sửa)</span>}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Đề kiểm tra Toán chương 1"
                    className="clay-input w-full px-4 py-3 rounded-xl"
                    disabled={isEditMode}
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#111812] dark:text-white">
                    {isEditMode ? 'Upload lại file đề thi' : 'File đề thi'} {!isEditMode && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="mc-exam-file-input"
                  />
                  <label
                    htmlFor="mc-exam-file-input"
                    className="flex items-center justify-center gap-2 clay-input w-full px-4 py-6 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <Icon name="upload_file" className="text-2xl text-gray-400" />
                    <div className="text-center">
                      {file ? (
                        <>
                          <p className="font-medium text-[#111812] dark:text-white">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-[#111812] dark:text-white">
                            Click để chọn file
                          </p>
                          <p className="text-xs text-gray-500">PDF, JPG, PNG, DOC, DOCX</p>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                {/* Total questions (optional) */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#111812] dark:text-white">
                    Số câu hỏi (tùy chọn)
                  </label>
                  <input
                    type="number"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(e.target.value)}
                    placeholder="Ví dụ: 20"
                    min="1"
                    className="clay-input w-full px-4 py-3 rounded-xl"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Để kiểm tra số đáp án nhập vào
                  </p>
                </div>
              </div>

              {/* Right - Answer key */}
              <div className="space-y-4">
                <h3 className="font-bold text-[#111812] dark:text-white flex items-center gap-2">
                  <Icon name="key" className="text-primary" />
                  Đáp án
                </h3>

                {/* Answer key input */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#111812] dark:text-white">
                    Nhập đáp án <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={answerKey}
                    onChange={(e) => setAnswerKey(e.target.value)}
                    placeholder="Ví dụ:&#10;1.A 2.B 3.C 4.D 5.A&#10;6.B 7.C 8.A 9.D 10.B&#10;&#10;Hoặc:&#10;Câu 1: A&#10;Câu 2: B&#10;..."
                    rows={8}
                    className="clay-input w-full px-4 py-3 rounded-xl resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Hỗ trợ nhiều định dạng: 1.A, 1-A, Câu 1: A,...
                  </p>
                </div>

                {/* Preview parsed answers */}
                {previewCount > 0 && (
                  <div className="clay-card p-4 bg-green-50 dark:bg-green-900/20">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                      <Icon name="check_circle" className="inline mr-1" />
                      Đã nhận diện {previewCount} câu:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(previewAnswers)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([num, ans]) => (
                          <span
                            key={num}
                            className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs font-mono"
                          >
                            {num}.{ans}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm">
                <Icon name="error" className="inline mr-1" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!processing && !uploading && (
          <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={(!isEditMode && !file) || (!isEditMode && !title.trim()) || previewCount === 0}
              className="flex-1"
            >
              <Icon name={isEditMode ? "check_circle" : "add_circle"} className="mr-2" />
              {isEditMode ? `Cập nhật (${previewCount} câu)` : `Tạo đề (${previewCount} câu)`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamMultipleChoiceModal;
