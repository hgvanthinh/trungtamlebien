// src/components/game/SpectatorOverlay.jsx
import { useCallback } from 'react';
import { sendTournamentEmoji } from '../../services/api/socket';
import EmojiReactionBar from './EmojiReactionBar';

function MatchCard({ match, players, onWatch, activeMatchId }) {
    const getPlayer = (uid) => players?.find(p => p.uid === uid);
    const p1 = getPlayer(match.player1Uid);
    const p2 = match.player2Uid ? getPlayer(match.player2Uid) : null;
    const p3 = match.player3Uid ? getPlayer(match.player3Uid) : null;
    const isWatching = match.roomId && match.matchId === activeMatchId;

    return (
        <div className={`rounded-xl border p-3 flex items-center gap-3 text-sm transition-colors
            ${isWatching ? 'border-indigo-400/60 bg-indigo-500/10' :
              match.status === 'playing' ? 'border-yellow-500/40 bg-yellow-500/5' :
              match.status === 'finished' ? 'border-green-500/20 bg-green-500/5 opacity-70' :
              'border-white/10 bg-white/5'}`}>
            <div className="flex-1 flex flex-col gap-1">
                {[p1, p2, p3].filter(Boolean).map(p => (
                    <span key={p.uid}
                        className={`font-medium ${match.winner === p.uid ? 'text-yellow-300' : 'text-white/80'}`}>
                        {match.winner === p.uid ? '🏆 ' : ''}{p.name}
                    </span>
                ))}
            </div>
            <div className="flex flex-col items-end gap-1">
                {match.status === 'playing' && !isWatching && (
                    <button onClick={() => onWatch(match.matchId)}
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-full transition-colors">
                        Xem
                    </button>
                )}
                {isWatching && (
                    <span className="text-xs text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">Đang xem</span>
                )}
                {match.status === 'finished' && (
                    <span className="text-xs text-green-400">Xong</span>
                )}
            </div>
        </div>
    );
}

/**
 * SpectatorOverlay — hiện khi người chơi bị loại trong chế độ Đấu Cặp
 *
 * Props:
 *   tournamentId: string
 *   tournament: object (publicTournamentState)
 *   activeMatchId: string | null — matchId đang xem spectate
 *   onWatch(matchId): callback khi chọn xem trận
 *   onStopWatch(): callback khi dừng xem
 *   isWatching: bool — đang xem 1 trận hay đang ở bracket view
 */
export default function SpectatorOverlay({
    tournamentId,
    tournament,
    activeMatchId,
    onWatch,
    onStopWatch,
    isWatching,
    floatingEmojis = [],
    addFloatingEmoji,
    removeFloatingEmoji,
}) {

    const handleWatch = useCallback((matchId) => {
        if (activeMatchId) {
            unspectateTournamentMatch(tournamentId, activeMatchId);
        }
        onWatch(matchId);
    }, [tournamentId, activeMatchId, onWatch]);

    const handleSendEmoji = useCallback((emoji) => {
        if (!activeMatchId) return;
        sendTournamentEmoji(tournamentId, activeMatchId, emoji);
        if (addFloatingEmoji) addFloatingEmoji(emoji, '');
    }, [tournamentId, activeMatchId, addFloatingEmoji]);

    if (!tournament) return null;

    const currentRound = tournament.rounds?.[tournament.currentRound] ?? [];

    return (
        <>
            {/* If watching a live match: thin overlay header + emoji bar */}
            {isWatching ? (
                <>
                    <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between
                        px-3 py-1.5 bg-black/70 backdrop-blur-sm border-b border-white/10">
                        <span className="text-xs text-white/60">👁 Chế độ khán giả</span>
                        <button onClick={onStopWatch}
                            className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-0.5 rounded-full transition-colors">
                            Bracket
                        </button>
                    </div>
                    <EmojiReactionBar
                        onSendEmoji={handleSendEmoji}
                        floatingEmojis={floatingEmojis}
                        onRemoveEmoji={removeFloatingEmoji ?? (() => {})}
                    />
                </>
            ) : (
                /* Full bracket overlay */
                <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-sm flex flex-col">
                    <div className="border-b border-white/10 px-4 py-3">
                        <h2 className="font-bold text-white text-lg">Chế độ khán giả</h2>
                        <p className="text-white/40 text-xs">
                            Vòng {(tournament.currentRound ?? 0) + 1} — Chọn trận để xem trực tiếp
                        </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {tournament.rounds?.map((round, roundIdx) => (
                            <div key={roundIdx} className="mb-6">
                                <h4 className="text-sm font-bold text-indigo-300 mb-2">Vòng {roundIdx + 1}</h4>
                                <div className="flex flex-col gap-2">
                                    {round.map(match => (
                                        <MatchCard
                                            key={match.matchId}
                                            match={match}
                                            players={tournament.players}
                                            onWatch={handleWatch}
                                            activeMatchId={activeMatchId}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </>
    );
}
