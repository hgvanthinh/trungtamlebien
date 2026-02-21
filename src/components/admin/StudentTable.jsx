import Avatar from '../common/Avatar';
import Button from '../common/Button';
import Icon from '../common/Icon';

const StudentTable = ({ students, onResetPassword, onDeleteStudent }) => {
  if (!students || students.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Icon name="school" className="text-6xl mb-4 opacity-50" />
        <p>Chưa có học sinh nào</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
              Học sinh
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
              Lớp
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
              Email
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
              Ngày tạo
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
              Thống kê
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr
              key={student.uid}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              {/* Student Info */}
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <Avatar src={student.avatar} name={student.fullName} size="sm" />
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">
                      {student.fullName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      @{student.username}
                    </p>
                  </div>
                </div>
              </td>

              {/* Class */}
              <td className="py-4 px-4 text-gray-700 dark:text-gray-300">
                {student.className}
              </td>

              {/* Email */}
              <td className="py-4 px-4 text-gray-700 dark:text-gray-300 text-sm">
                {student.email}
              </td>

              {/* Created Date */}
              <td className="py-4 px-4 text-gray-600 dark:text-gray-400 text-sm">
                {new Date(student.createdAt).toLocaleDateString('vi-VN')}
              </td>

              {/* Stats */}
              <td className="py-4 px-4">
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                    {student.stats?.completedLessons || 0} bài
                  </span>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                    {student.stats?.averageScore || 0}%
                  </span>
                </div>
              </td>

              {/* Actions */}
              <td className="py-4 px-4">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => onResetPassword(student)}
                    className="text-sm py-2 px-3"
                    title="Reset mật khẩu"
                  >
                    <Icon name="lock_reset" className="text-blue-600 dark:text-blue-400" />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => onDeleteStudent(student)}
                    className="text-sm py-2 px-3"
                    title="Xóa tài khoản"
                  >
                    <Icon name="delete" className="text-red-600 dark:text-red-400" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentTable;
