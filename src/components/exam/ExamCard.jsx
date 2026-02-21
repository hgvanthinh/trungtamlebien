import Icon from '../common/Icon';

// Helper để xác định màu sắc và icon theo loại đề
const getExamTypeConfig = (type) => {
  switch (type) {
    case 'upload':
      return {
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-600 dark:text-blue-400',
        icon: 'picture_as_pdf',
        label: 'Tự luận',
      };
    case 'multiple_choice':
      return {
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-600 dark:text-green-400',
        icon: 'quiz',
        label: 'Trắc nghiệm',
      };
    case 'mixed_exam':
      return {
        bgColor: 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30',
        textColor: 'text-purple-600 dark:text-purple-400',
        icon: 'ballot',
        label: 'Trắc nghiệm',
      };
    default:
      return {
        bgColor: 'bg-gray-100 dark:bg-gray-900/30',
        textColor: 'text-gray-600 dark:text-gray-400',
        icon: 'description',
        label: 'Khác',
      };
  }
};

const ExamCard = ({
  exam,
  onDelete,
  onAssign,
  onEdit,
}) => {
  const typeConfig = getExamTypeConfig(exam.type);

  return (
    <div className="clay-card p-4 hover:shadow-xl transition-all flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Type Icon */}
        <div className={`p-2 rounded-lg flex-shrink-0 ${typeConfig.bgColor}`}>
          <Icon
            name={typeConfig.icon}
            className={`text-lg ${typeConfig.textColor}`}
          />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-[#111812] dark:text-white mb-1 truncate">
            {exam.title}
          </h3>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${typeConfig.bgColor} ${typeConfig.textColor}`}>
            <Icon name={typeConfig.icon} className="text-xs" />
            {typeConfig.label}
          </span>
        </div>
      </div>

      {/* Stats cho trắc nghiệm */}
      {exam.type === 'multiple_choice' && exam.totalQuestions > 0 && (
        <div className="flex gap-3 mb-3 text-xs">
          <div className="flex items-center gap-1">
            <Icon name="quiz" className="text-primary text-sm" />
            <span className="font-bold text-[#111812] dark:text-white">{exam.totalQuestions} câu</span>
          </div>
        </div>
      )}

      {/* Stats cho đề trắc nghiệm */}
      {exam.type === 'mixed_exam' && exam.questionTypes && (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-2 text-xs font-bold text-[#111812] dark:text-white">
            <Icon name="ballot" className="text-primary text-sm" />
            {exam.totalQuestions} câu - 10 điểm
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {exam.questionTypes.abcd?.enabled && (
              <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                {exam.questionTypes.abcd.count} ABCD
              </span>
            )}
            {exam.questionTypes.trueFalse?.enabled && (
              <span className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">
                {exam.questionTypes.trueFalse.count} Đ/S
              </span>
            )}
            {exam.questionTypes.shortAnswer?.enabled && (
              <span className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded">
                {exam.questionTypes.shortAnswer.count} TL
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-1.5 mt-auto">
        <button
          onClick={() => onAssign(exam)}
          className="px-2 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-all flex items-center justify-center gap-1 col-span-2"
        >
          <Icon name="send" className="text-sm" />
          Giao bài
        </button>

        <button
          onClick={() => onEdit(exam)}
          className="px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all flex items-center justify-center gap-1"
        >
          <Icon name="edit" className="text-sm" />
          Sửa
        </button>

        <button
          onClick={() => onDelete(exam.id)}
          className="px-2 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center justify-center gap-1"
        >
          <Icon name="delete" className="text-sm" />
          Xóa
        </button>
      </div>
    </div>
  );
};

export default ExamCard;
