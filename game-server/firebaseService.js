// game-server/firebaseService.js
// ─── Firebase Database Functions for Game Server ───────────

import admin from 'firebase-admin';
import { ENTRY_COST, calcReward } from './constants.js';

let db;

export function initFirebaseService(firebaseDb) {
    db = firebaseDb;
}

/** Deduct ENTRY_COST from all players, catch errors silently */
export async function deductEntryFees(players) {
    console.log(`[Xu] deductEntryFees called for ${players.length} players: ${players.map(p => p.uid).join(', ')}`);
    const promises = players.map(async (p) => {
        try {
            const ref = db.collection('users').doc(p.uid);
            const snap = await ref.get();
            if (!snap.exists) {
                console.warn(`[Xu] User doc NOT FOUND for uid: ${p.uid}`);
                return;
            }
            const before = snap.data()?.coins ?? 0;
            const newCoins = Math.max(0, before - ENTRY_COST);
            await ref.update({ coins: newCoins });
            console.log(`[Xu] Deducted ${ENTRY_COST} from ${p.uid}: ${before} → ${newCoins}`);
        } catch (e) {
            console.error(`[Xu] FAILED deduct from ${p.uid}:`, e.message, e.code);
        }
    });
    await Promise.all(promises);
    console.log('[Xu] deductEntryFees done.');
}

/** Hoàn trả ENTRY_COST cho những người còn sống (dùng khi hết giờ mà hòa) */
export async function refundSurvivors(players, survivorUids) {
    const set = new Set(survivorUids);
    console.log(`[Xu] refundSurvivors: hoàn trả ${ENTRY_COST} Xu cho ${survivorUids.length} người sống`);
    const promises = players.map(async (p) => {
        try {
            const ref = db.collection('users').doc(p.uid);
            const snap = await ref.get();
            if (!snap.exists) return;
            const before = snap.data()?.coins ?? 0;
            if (set.has(p.uid)) {
                // Người còn sống: hoàn lại xu đã trừ trước đó
                await ref.update({ coins: before + ENTRY_COST });
                console.log(`[Xu] Hoàn trả ${ENTRY_COST} cho ${p.uid}: ${before} → ${before + ENTRY_COST}`);
            } else {
                // Người đã chết: không hoàn (xu đã hoàn toàn bị trừ từ deductEntryFees)
                console.log(`[Xu] ${p.uid} đã bị loại - không hoàn xu`);
            }
        } catch (e) {
            console.error(`[Xu] FAILED refund ${p.uid}:`, e.message);
        }
    });
    await Promise.all(promises);
    console.log('[Xu] refundSurvivors done.');
}

/** Award winner with playerCount * ENTRY_COST xu (no artificial floor) */
export async function rewardWinner(uid, playerCount) {
    try {
        const reward = calcReward(playerCount); // = playerCount × 20 Xu
        console.log(`[Xu] rewardWinner uid=${uid} | playerCount=${playerCount} | reward=${reward}`);
        const ref = db.collection('users').doc(uid);
        const snap = await ref.get();
        if (!snap.exists) {
            console.warn(`[Xu] Winner doc NOT FOUND for uid: ${uid}`);
            return;
        }
        const before = snap.data()?.coins ?? 0;
        await ref.update({ coins: before + reward });
        console.log(`[Xu] Awarded ${reward} to ${uid}: ${before} → ${before + reward}`);
    } catch (e) {
        console.error(`[Xu] FAILED reward uid ${uid}:`, e.message, e.code);
    }
}
