import Icon from '../common/Icon';
import Button from '../common/Button';

const FileProcessingProgress = ({ stage, progress, estimatedTime, currentFile, totalFiles, onCancel }) => {
  const stageLabels = {
    preparing: 'Đang chuẩn bị...',
    converting: 'Đang chuyển đổi sang PDF...',
    compressing: 'Đang nén file...',
    processing: 'Đang xử lý ảnh...',
    uploading: 'Đang upload lên server...',
    complete: 'Hoàn thành!',
  };

  const stageIcons = {
    preparing: 'settings',
    converting: 'autorenew',
    compressing: 'compress',
    uploading: 'cloud_upload',
    complete: 'check_circle',
  };

  const getIconAnimation = () => {
    if (stage === 'complete') return '';
    if (stage === 'converting' || stage === 'preparing') return 'animate-spin';
    return '';
  };

  const getIconColor = () => {
    if (stage === 'complete') return 'text-green-500';
    return 'text-primary';
  };

  return (
    <div className="space-y-4">
      {/* Stage indicator */}
      <div className="flex items-center gap-3">
        <Icon
          name={stageIcons[stage] || 'info'}
          className={`text-3xl ${getIconColor()} ${getIconAnimation()}`}
        />
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-white">
            {stageLabels[stage] || 'Đang xử lý...'}
          </p>
          {totalFiles && totalFiles > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Ảnh {currentFile || 1}/{totalFiles}
            </p>
          )}
          {estimatedTime && stage !== 'complete' && stage !== 'uploading' && !totalFiles && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Còn khoảng {Math.max(1, estimatedTime - Math.floor(progress / 10))}s
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="text-sm text-center text-gray-600 dark:text-gray-400">
          {Math.round(Math.min(progress, 100))}%
        </p>
      </div>

      {/* Cancel button (only during processing, not uploading) */}
      {stage !== 'uploading' && stage !== 'complete' && (
        <Button variant="secondary" onClick={onCancel} className="w-full">
          <Icon name="close" className="mr-2" />
          Hủy
        </Button>
      )}

      {/* Completion message */}
      {stage === 'complete' && (
        <div className="text-center text-green-600 dark:text-green-400 text-sm font-medium">
          <Icon name="check_circle" className="mr-1" />
          Đã xử lý xong!
        </div>
      )}
    </div>
  );
};

export default FileProcessingProgress;
