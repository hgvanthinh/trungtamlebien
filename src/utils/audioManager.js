// src/utils/audioManager.js
// Hệ thống âm thanh tối ưu cho BombGame
// Sử dụng Audio Sprite để giảm số lượng HTTP request

import { Howl } from 'howler';

// 1. Âm thanh hiệu ứng (SFX)
export const gameAudio = new Howl({
    src: ['/assets/audio/gamesprite.mp3'],
    sprite: {
        walk: [0, 200],
        placeBomb: [500, 300],
        explosion: [1000, 800],
        powerup: [2000, 500],
        die: [3000, 1000],
    },
    volume: 0.5,
    preload: true,
});

// 2. NHẠC NỀN (BGM)
export const bgmAudio = new Howl({
    src: ['/assets/audio/bgm.mp3'], // File nhạc nền
    loop: true, // Lặp lại liên tục
    volume: 0.25, // Nhạc nền nhỏ hơn hiệu ứng
});

// 3. Trạng thái âm thanh mặc định: BẬT
export let isMuted = false;

// Đảm bảo khởi tạo đúng trạng thái ban đầu
gameAudio.mute(isMuted);
bgmAudio.mute(isMuted);

/**
 * Đảo trạng thái mute/unmute.
 * @returns {boolean} Trạng thái isMuted MỚI
 */
export const toggleMute = () => {
    isMuted = !isMuted;
    gameAudio.mute(isMuted);
    bgmAudio.mute(isMuted);
    return isMuted;
};

/**
 * Phát âm thanh hiệu ứng
 */
export const playSound = (spriteName) => {
    if (!isMuted) gameAudio.play(spriteName);
};

/**
 * Phát nhạc nền
 */
export const playBGM = () => {
    if (!isMuted && !bgmAudio.playing()) bgmAudio.play();
};

/**
 * Tắt nhạc nền
 */
export const stopBGM = () => {
    bgmAudio.stop();
};