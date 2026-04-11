// game-server/tournamentEngine.js
// ─── Tournament Logic ──────────────────────────────────────────────────

import { createRoom, gameStates, tournaments, socketByUid } from './stateManagers.js';
import { initGameState, publicState } from './gameEngine.js';

/** Tạo bracket từ danh sách người chơi + các cặp đã chấp nhận */
export function createTournamentBracket(players, acceptedPairs = []) {
    const matches = [];
    const paired = new Set();

    // Ưu tiên cặp đã thách đấu
    for (const [uid1, uid2] of acceptedPairs) {
        if (!paired.has(uid1) && !paired.has(uid2)) {
            const p1 = players.find(p => p.uid === uid1);
            const p2 = players.find(p => p.uid === uid2);
            if (p1 && p2) {
                matches.push({
                    matchId: `match_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                    player1Uid: uid1, player2Uid: uid2, player3Uid: null,
                    roomId: null, status: 'pending', winner: null,
                });
                paired.add(uid1);
                paired.add(uid2);
            }
        }
    }

    // Ghép random phần còn lại
    const remaining = players.filter(p => !paired.has(p.uid));
    // Fisher-Yates shuffle
    for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    for (let i = 0; i < remaining.length; i += 2) {
        if (i + 1 < remaining.length) {
            matches.push({
                matchId: `match_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                player1Uid: remaining[i].uid, player2Uid: remaining[i + 1].uid, player3Uid: null,
                roomId: null, status: 'pending', winner: null,
            });
        } else {
            // Số lẻ: ghép 3 người vào cặp trận cuối
            if (matches.length > 0) {
                matches[matches.length - 1].player3Uid = remaining[i].uid;
            } else {
                // Chỉ có 1 người duy nhất → bye (thắng luôn)
                matches.push({
                    matchId: `match_${Date.now()}_bye`,
                    player1Uid: remaining[i].uid, player2Uid: null, player3Uid: null,
                    roomId: null, status: 'finished', winner: remaining[i].uid,
                });
            }
        }
    }

    return matches;
}

/** Bắt đầu một vòng tournament */
export async function startTournamentRound(tournamentId, io) {
    const t = tournaments.get(tournamentId);
    if (!t) return;

    const round = t.rounds[t.currentRound];
    console.log(`🏆 [Tournament] Starting round ${t.currentRound + 1} for "${t.name}" (${round.length} matches)`);

    for (let i = 0; i < round.length; i++) {
        const match = round[i];
        if (match.status === 'finished') continue; // bye match

        // Gom danh sách player cho trận này
        const matchPlayerUids = [match.player1Uid, match.player2Uid, match.player3Uid].filter(Boolean);
        const matchPlayers = matchPlayerUids.map(uid => t.players.find(p => p.uid === uid)).filter(Boolean);

        // Tạo room riêng cho trận
        const hostPlayer = matchPlayers[0];
        const matchRoom = createRoom(
            hostPlayer.uid, hostPlayer.name, hostPlayer.photoURL,
            `[Đấu Cặp] Vòng ${t.currentRound + 1} - Trận ${i + 1}`,
            {
                mode: 'dauCap',
                maxPlayers: matchPlayers.length,
                tournamentId,
                matchId: match.matchId,
            }
        );

        // Thêm các player vào room (host đã có, thêm phần còn lại)
        for (const p of matchPlayers.slice(1)) {
            matchRoom.players.push({ uid: p.uid, name: p.name, photoURL: p.photoURL, isReady: true, isHost: false });
        }
        matchRoom.players[0].isReady = true;
        matchRoom.status = 'playing';

        // Init game state (Đấu Cặp: 90s, không có life item)
        const gs = initGameState(matchRoom, {
            durationMs: 90_000,
            noLifeItem: true,
            tournamentId,
            matchId: match.matchId,
        });
        gameStates.set(matchRoom.id, gs);

        match.roomId = matchRoom.id;
        match.status = 'playing';

        // Join socket rooms + notify players
        for (const p of matchPlayers) {
            const s = socketByUid.get(p.uid);
            if (s) {
                s.join(matchRoom.id);
                s.emit('tournament:match_start', {
                    matchId: match.matchId,
                    roomId: matchRoom.id,
                    tournamentId,
                    opponentName: matchPlayers.filter(x => x.uid !== p.uid).map(x => x.name).join(' & '),
                });
                s.emit('game:start', { roomId: matchRoom.id, gameState: publicState(gs) });
            }
        }
    }
}
