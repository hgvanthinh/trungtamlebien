import { auth } from '../config/firebase';
import { getIdToken } from 'firebase/auth';

const FUNCTIONS_URL = 'https://asia-southeast1-toanthaybien-2c3d2.cloudfunctions.net';

/**
 * Gọi một Cloud Function xử lý tiền.
 *
 * Mọi thay đổi số dư Xu/Vàng đều phải đi qua đây — Firestore rules đã chặn
 * client ghi trực tiếp coins/gold, nên KHÔNG được quay lại dùng updateDoc.
 * uid luôn do server lấy từ token, client không cần (và không nên) gửi lên.
 */
export const callMoneyFunction = async (name, payload = {}) => {
    if (!auth.currentUser) throw new Error('Bạn chưa đăng nhập');

    const idToken = await getIdToken(auth.currentUser);
    let res;
    try {
        res = await fetch(`${FUNCTIONS_URL}/${name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(payload),
        });
    } catch {
        throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé!');
    }

    let data;
    try {
        data = await res.json();
    } catch {
        throw new Error('Máy chủ trả về dữ liệu không hợp lệ');
    }

    // Envelope: { ok, data } | { ok: false, error }.
    // Dữ liệu nghiệp vụ nằm trong `data` chứ không trộn phẳng vào envelope —
    // craftGold có field `success` mang nghĩa "thắng/thua" (= 0 khi thua), nếu
    // trộn phẳng thì nó ghi đè cờ trạng thái và mọi lần thua thành lỗi giả.
    if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Thao tác không thành công');
    }
    return data.data ?? {};
};
