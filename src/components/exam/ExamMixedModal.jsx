import { useState, useMemo } from 'react';
import { createMixedExam } from '../../services/examBankService';
import { processFileForExam, estimateProcessingTime } from '../../services/fileProcessingService';
import { calculateDynamicPoints, validateQuestionCounts, formatPoints } from '../../utils/examScoring';
import Button from '../common/Button';
import Icon from '../common/Icon';
import FileProcessingProgress from './FileProcessingProgress';
import AbcdGridInput from './AbcdGridInput';
import TrueFalseGridInput from './TrueFalseGridInput';
import ShortAnswerGridInput from './ShortAnswerGridInput';

const ExamMixedModal = ({ currentUser, onClose, onComplete }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);

  // ABCD Multiple Choice - now using grid format { 1: 'A', 2: 'B', ... }
  const [abcdAnswers, setAbcdAnswers] = useState({});

  // True/False - { 1: { a: true, b: false, c: true, d: false }, ... }
  const [trueFalseQuestions, setTrueFalseQuestions] = useState({});

  // Short Answer - { 1: ['answer1', 'answer2'], 2: ['answer'], ... }
  const [shortAnswerQuestions, setShortAnswerQuestions] = useState({});

  // Settings
  const [caseSensitive, setCaseSensitive] = useState(false);

  // UI State
  const [expandedSections, setExpandedSections] = useState({
    abcd: true,
    trueFalse: true,
    shortAnswer: true
  });
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processProgress, setProcessProgress] = useState(null);
  const [error, setError] = useState('');

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
      setError('Chỉ hỗ trợ file PDF, ảnh (JPG, PNG) hoặc Word (DOC, DOCX)');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File không được vượt quá 50MB');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  // Calculate question counts
  const questionCounts = useMemo(() => {
    const abcdCount = Object.keys(abcdAnswers).length;
    const trueFalseCount = Object.keys(trueFalseQuestions).length;
    const shortAnswerCount = Object.keys(shortAnswerQuestions).length;

    return {
      abcd: abcdCount,
      trueFalse: trueFalseCount,
      shortAnswer: shortAnswerCount
    };
  }, [abcdAnswers, trueFalseQuestions, shortAnswerQuestions]);

  // Calculate dynamic points
  const dynamicPoints = useMemo(() => {
    return calculateDynamicPoints(questionCounts);
  }, [questionCounts]);

  // Total questions and validation
  const totalQuestions = questionCounts.abcd + questionCounts.trueFalse + questionCounts.shortAnswer;
  const validation = validateQuestionCounts(questionCounts);

  // Validate all inputs
  const validateInputs = () => {
    setError('');

    if (!title.trim()) {
      setError('Vui lòng nhập tên đề thi');
      return false;
    }

    if (!file) {
      setError('Vui lòng chọn file đề thi');
      return false;
    }

    if (!validation.valid) {
      setError(validation.errors[0]);
      return false;
    }

    // Validate True/False questions have all 4 sub-items answered
    for (const [num, answers] of Object.entries(trueFalseQuestions)) {
      const keys = Object.keys(answers);
      if (keys.length !== 4 || !['a', 'b', 'c', 'd'].every(k => k in answers)) {
        setError(`Câu Đúng/Sai ${num}: Phải có đủ 4 ý a, b, c, d`);
        return false;
      }
    }

    // Validate Short Answer questions have at least 1 answer
    for (const [num, answers] of Object.entries(shortAnswerQuestions)) {
      if (!Array.isArray(answers) || answers.length === 0) {
        setError(`Câu Trả lời ngắn ${num}: Phải có ít nhất 1 đáp án`);
        return false;
      }
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validateInputs()) {
      return;
    }

    try {
      // Step 1: Process file
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

      // Step 2: Create exam
      setProcessing(false);
      setUploading(true);
      setProcessProgress({
        stage: 'uploading',
        progress: 0,
      });

      // Build answer key
      const answerKey = {
        abcd: abcdAnswers,
        trueFalse: trueFalseQuestions,
        shortAnswer: shortAnswerQuestions
      };

      // Build question types config
      const questionTypes = {
        abcd: { count: questionCounts.abcd },
        trueFalse: { count: questionCounts.trueFalse },
        shortAnswer: { count: questionCounts.shortAnswer }
      };

      // Settings
      const settings = {
        caseSensitive,
        trimWhitespace: true,
        normalizeSpaces: true
      };

      const result = await createMixedExam(
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
        questionTypes,
        answerKey,
        settings
      );

      setUploading(false);
      setProcessProgress(null);

      if (result.success) {
        onComplete({
          ...result,
          message: `Tạo đề trắc nghiệm thành công! ${totalQuestions} câu (${questionCounts.abcd} ABCD + ${questionCounts.trueFalse} Đ/S + ${questionCounts.shortAnswer} TLN).`,
        });
      } else {
        setError('Tạo đề thất bại: ' + result.error);
      }
    } catch (error) {
      setProcessing(false);
      setUploading(false);
      setProcessProgress(null);
      setError('Lỗi: ' + error.message);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section]
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-[#111812] dark:text-white">
            Tạo đề trắc nghiệm
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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* File upload and title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[#111812] dark:text-white">
                  Tên đề thi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Đề kiểm tra Toán chương 1"
                  className="clay-input w-full px-4 py-3 rounded-xl"
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[#111812] dark:text-white">
                  File đề thi <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="mixed-exam-file-input"
                />
                <label
                  htmlFor="mixed-exam-file-input"
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
            </div>

            {/* Section 1: ABCD Multiple Choice */}
            <div className="clay-card p-4">
              <button
                type="button"
                onClick={() => toggleSection('abcd')}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <h3 className="font-bold text-[#111812] dark:text-white flex items-center gap-2">
                    <Icon name="check_circle" className="text-blue-500" />
                    TRẮC NGHIỆM ABCD
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Tối đa 12 câu — Cả phần: <strong>3đ</strong> — Mỗi câu: {formatPoints(dynamicPoints.abcd)}đ
                  </p>
                </div>
                <Icon name={expandedSections.abcd ? 'expand_less' : 'expand_more'} />
              </button>

              {expandedSections.abcd && (
                <div className="mt-4">
                  <AbcdGridInput
                    maxQuestions={12}
                    value={abcdAnswers}
                    onChange={setAbcdAnswers}
                  />
                </div>
              )}
            </div>

            {/* Section 2: True/False */}
            <div className="clay-card p-4">
              <button
                type="button"
                onClick={() => toggleSection('trueFalse')}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <h3 className="font-bold text-[#111812] dark:text-white flex items-center gap-2">
                    <Icon name="toggle_on" className="text-green-500" />
                    ĐÚNG/SAI
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Tối đa 4 câu × 4 ý — Cả phần: <strong>4đ</strong> — Mỗi câu: {formatPoints(dynamicPoints.trueFalse)}đ
                    <br />
                    <span className="text-[10px]">
                      Chấm điểm: 4/4=1đ, 3/4=0.5đ, 2/4=0.25đ, 1/4=0.1đ (nhân với điểm câu)
                    </span>
                  </p>
                </div>
                <Icon name={expandedSections.trueFalse ? 'expand_less' : 'expand_more'} />
              </button>

              {expandedSections.trueFalse && (
                <div className="mt-4">
                  <TrueFalseGridInput
                    maxQuestions={4}
                    value={trueFalseQuestions}
                    onChange={setTrueFalseQuestions}
                  />
                </div>
              )}
            </div>

            {/* Section 3: Short Answer */}
            <div className="clay-card p-4">
              <button
                type="button"
                onClick={() => toggleSection('shortAnswer')}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <h3 className="font-bold text-[#111812] dark:text-white flex items-center gap-2">
                    <Icon name="edit" className="text-purple-500" />
                    TRẢ LỜI NGẮN
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Tối đa 6 câu — Cả phần: <strong>3đ</strong> — Mỗi câu: {formatPoints(dynamicPoints.shortAnswer)}đ
                  </p>
                </div>
                <Icon name={expandedSections.shortAnswer ? 'expand_less' : 'expand_more'} />
              </button>

              {expandedSections.shortAnswer && (
                <div className="mt-4 space-y-3">
                  <ShortAnswerGridInput
                    maxQuestions={6}
                    value={shortAnswerQuestions}
                    onChange={setShortAnswerQuestions}
                  />

                  {/* Case sensitive option */}
                  {questionCounts.shortAnswer > 0 && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <input
                        type="checkbox"
                        checked={caseSensitive}
                        onChange={(e) => setCaseSensitive(e.target.checked)}
                        className="rounded"
                      />
                      Phân biệt chữ hoa/thường
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="clay-card p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border-2 border-blue-200 dark:border-blue-700">
              <h4 className="font-bold text-lg text-[#111812] dark:text-white mb-2">
                TỔNG ĐIỂM TỐI ĐA: {formatPoints(dynamicPoints.total)}đ
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (ABCD {questionCounts.abcd > 0 ? '3đ' : '0đ'} + Đ/S {questionCounts.trueFalse > 0 ? '4đ' : '0đ'} + TLN {questionCounts.shortAnswer > 0 ? '3đ' : '0đ'})
                </span>
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Tổng số câu: <strong>{totalQuestions}</strong> ({questionCounts.abcd} ABCD + {questionCounts.trueFalse} Đ/S + {questionCounts.shortAnswer} TL)
              </p>
              {!validation.valid && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  <Icon name="error" className="inline mr-1" />
                  {validation.errors[0]}
                </p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm">
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
              onClick={handleCreate}
              disabled={!file || !title.trim() || totalQuestions === 0 || !validation.valid}
              className="flex-1"
            >
              <Icon name="add_circle" className="mr-2" />
              Tạo đề ({totalQuestions} câu - {formatPoints(dynamicPoints.total)}đ)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamMixedModal;
