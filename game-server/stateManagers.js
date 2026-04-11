/**
 * game-server/stateManagers.js
 * Extracted state objects and helper functions for Rooms, GameStates, and Tournaments.
 */

// ─── Shared State ──────────────────────────────────────────────
export const rooms = new Map();        // roomId → RoomObject
export const gameStates = new Map();   // roomId → GameState
export const tournaments = new Map();  // tournamentId → TournamentObject
export const socketByUid = new Map();  // uid → socket (O(1) lookup)
export const loandauQueue = new Map(); // LOANDAU_QUEUE_ID → { hostUid, players, createdAt }

// ─── Helpers ───────────────────────────────────────────────────

export function buildRoomSummary(room) {
    return {
        id: room.id, name: room.name, host: room.host,
        playerCount: room.players.length, maxPlayers: room.maxPlayers,
        status: room.status,
    };
}

export function getAllRooms() {
    return [...rooms.values()].map(r => buildRoomSummary(r));
}

export function createRoom(hostUid, hostName, hostPhotoURL, roomName, options = {}) {
    const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const room = {
        id, name: roomName, host: hostUid,
        players: [{ uid: hostUid, name: hostName, photoURL: hostPhotoURL, isReady: false, isHost: true }],
        status: 'waiting',
        mode: options.mode ?? 'loanDau',       // 'loanDau' | 'dauCap'
        maxPlayers: options.maxPlayers ?? 5,   // Loạn Đấu default = 5
        tournamentId: options.tournamentId ?? null,
        matchId: options.matchId ?? null,
        createdAt: Date.now(),
    };
    rooms.set(id, room);
    return room;
}

export function publicTournamentState(t) {
    return {
        id: t.id, name: t.name, hostUid: t.hostUid, status: t.status,
        players: t.players,
        rounds: t.rounds.map(round =>
            round.map(m => ({
                matchId: m.matchId,
                player1Uid: m.player1Uid,
                player2Uid: m.player2Uid,
                player3Uid: m.player3Uid ?? null,
                roomId: m.roomId,
                status: m.status,
                winner: m.winner,
            }))
        ),
        currentRound: t.currentRound,
        champion: t.champion,
        pendingChallenges: [...(t.pendingChallenges?.entries() ?? [])].map(
            ([challengerUid, targetUid]) => ({ challengerUid, targetUid })
        ),
        acceptedPairs: t.acceptedPairs ?? [],
    };
}

export function getTournamentList() {
    return [...tournaments.values()]
        .filter(t => t.status === 'lobby' || t.status === 'round_active')
        .map(t => ({
            id: t.id, name: t.name,
            hostName: t.players.find(p => p.uid === t.hostUid)?.name ?? '',
            playerCount: t.players.length,
            status: t.status,
        }));
}
