import { useState, useEffect } from 'react';
import {
  createExam,
  updateExam,
  addQuestion,
  getExamQuestions,
  updateQuestion,
  deleteQuestion,
} from '../../services/examBankService';
import Button from '../common/Button';
import Icon from '../common/Icon';
import QuestionEditor from './QuestionEditor';

const ExamEditorModal = ({ currentUser, classes, exam, onClose, onComplete }) => {
  const [examData, setExamData] = useState({
    title: exam?.title || '',
    duration: exam?.duration || 60,
  });
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [currentExamId, setCurrentExamId] = useState(exam?.id || null);

  useEffect(() => {
    if (exam) {
      loadQuestions();
    }
  }, [exam]);

  const loadQuestions = async () => {
    if (!exam) return;
    const result = await getExamQuestions(exam.id);
    if (result.success) {
      setQuestions(result.questions);
    }
  };

  const handleSaveExam = async () => {
    if (!examData.title.trim()) {
      alert('Vui lòng nhập tên đề thi');
      return;
    }

    setLoading(true);

    if (currentExamId) {
      // Update existing exam
      const result = await updateExam(currentExamId, examData);
      if (result.success) {
        alert('Đã cập nhật đề thi');
        onComplete();
      } else {
        alert(result.error);
      }
    } else {
      // Create new exam
      const result = await createExam({
        ...examData,
        type: 'manual',
        createdBy: currentUser.uid,
        totalQuestions: 0,
        totalPoints: 0,
        isPublished: false,
      });

      if (result.success) {
        setCurrentExamId(result.examId);
        alert('Đã tạo đề thi. Bây giờ hãy thêm câu hỏi!');
      } else {
        alert(result.error);
      }
    }

    setLoading(false);
  };

  const handleAddQuestion = () => {
    if (!currentExamId) {
      alert('Vui lòng lưu đề thi trước khi thêm câu hỏi');
      return;
    }
    setEditingQuestion(null);
    setShowQuestionEditor(true);
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setShowQuestionEditor(true);
  };

  const handleSaveQuestion = async (questionData) => {
    if (!currentExamId) return;

    setLoading(true);

    if (editingQuestion) {
      // Update existing question
      const result = await updateQuestion(currentExamId, editingQuestion.id, questionData);
      if (result.success) {
        await loadQuestions();
        setShowQuestionEditor(false);
      } else {
        alert(result.error);
      }
    } else {
      // Add new question
      const result = await addQuestion(currentExamId, {
        ...questionData,
        order: questions.length + 1,
      });

      if (result.success) {
        await loadQuestions();
        setShowQuestionEditor(false);
      } else {
        alert(result.error);
      }
    }

    setLoading(false);
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('Bạn có chắc muốn xóa câu hỏi này?')) return;

    setLoading(true);
    const result = await deleteQuestion(currentExamId, questionId);

    if (result.success) {
      await loadQuestions();
    } else {
      alert(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {exam ? 'Chỉnh sửa đề thi' : 'Tạo đề thi mới'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <Icon name="close" />
          </button>
        </div>

        {!showQuestionEditor ? (
          <>
            {/* Exam Info */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tên đề thi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={examData.title}
                  onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                  placeholder="Ví dụ: Kiểm tra 15 phút - Chương 1"
                  className="clay-input w-full px-4 py-3 rounded-xl"
                />
              </div>



              <div>
                <label className="block text-sm font-medium mb-2">
                  Thời gian làm bài (phút)
                </label>
                <input
                  type="number"
                  value={examData.duration}
                  onChange={(e) => setExamData({ ...examData, duration: parseInt(e.target.value) })}
                  min={1}
                  className="clay-input w-full px-4 py-3 rounded-xl"
                />
              </div>

              <Button
                variant="primary"
                onClick={handleSaveExam}
                disabled={loading}
                className="w-full"
              >
                {currentExamId ? 'Cập nhật thông tin' : 'Tạo đề thi'}
              </Button>
            </div>

            {/* Questions List */}
            {currentExamId && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Danh sách câu hỏi ({questions.length})
                  </h3>
                  <Button
                    variant="primary"
                    onClick={handleAddQuestion}
                    className="flex items-center gap-2"
                  >
                    <Icon name="add" />
                    Thêm câu hỏi
                  </Button>
                </div>

                {questions.length === 0 ? (
                  <div className="text-center py-12 clay-input rounded-xl">
                    <Icon name="quiz" className="text-6xl text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Chưa có câu hỏi. Hãy thêm câu hỏi đầu tiên!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {questions.map((question, index) => (
                      <div
                        key={question.id}
                        className="clay-input p-4 rounded-xl flex justify-between items-start"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-bold text-primary">
                              Câu {index + 1}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                              {question.type === 'multiple_choice' && 'Trắc nghiệm'}
                              {question.type === 'true_false' && 'Đúng/Sai'}
                              {question.type === 'short_answer' && 'Trả lời ngắn'}
                              {question.type === 'essay' && 'Tự luận'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {question.points} điểm
                            </span>
                          </div>
                          <p className="text-sm line-clamp-2">{question.questionText}</p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEditQuestion(question)}
                          >
                            <Icon name="edit" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteQuestion(question.id)}
                          >
                            <Icon name="delete" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Close Button */}
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Đóng
              </Button>
              {currentExamId && (
                <Button variant="primary" onClick={onComplete} className="flex-1">
                  Hoàn thành
                </Button>
              )}
            </div>
          </>
        ) : (
          <QuestionEditor
            question={editingQuestion}
            onSave={handleSaveQuestion}
            onCancel={() => setShowQuestionEditor(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ExamEditorModal;
