// src/pages/public/TournamentLobby.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    socket,
    joinTournament, leaveTournament,
    sendChallenge, respondChallenge,
    startTournament,
    spectateTournamentMatch, unspectateTournamentMatch,
    sendTournamentEmoji,
} from '../../services/api/socket';
import { auth } from '../../config/firebase';

// ─── Bracket View ──────────────────────────────────────────────
function MatchCard({ match, players, onWatch }) {
    const getPlayer = (uid) => players.find(p => p.uid === uid);
    const p1 = getPlayer(match.player1Uid);
    const p2 = match.player2Uid ? getPlayer(match.player2Uid) : null;
    const p3 = match.player3Uid ? getPlayer(match.player3Uid) : null;
    const winner = match.winner ? getPlayer(match.winner) : null;

    return (
        <div className={`rounded-xl border p-3 flex items-center gap-3 text-sm
            ${match.status === 'playing' ? 'border-yellow-500/50 bg-yellow-500/5' :
              match.status === 'finished' ? 'border-green-500/30 bg-green-500/5 opacity-80' :
              'border-white/10 bg-white/5'}`}>
            <div className="flex-1 flex flex-col gap-1">
                {[p1, p2, p3].filter(Boolean).map(p => (
                    <span key={p.uid} className={`font-medium
                        ${match.winner === p.uid ? 'text-yellow-300' : 'text-white/80'}`}>
                        {match.winner === p.uid ? '🏆 ' : ''}{p.name}
                    </span>
                ))}
                {match.status === 'finished' && winner && (
                    <span className="text-xs text-green-400">Thắng: {winner.name}</span>
                )}
            </div>
            <div className="flex flex-col items-end gap-1">
                {match.status === 'playing' && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">Đang đấu</span>
                )}
                {match.status === 'finished' && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Xong</span>
                )}
                {match.status === 'playing' && onWatch && (
                    <button onClick={() => onWatch(match.matchId)}
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded-full transition-colors">
                        Xem trực tiếp
                    </button>
                )}
            </div>
        </div>
    );
}

function TournamentBracket({ tournament, onWatch }) {
    if (!tournament?.rounds?.length) return null;
    return (
        <div className="flex flex-col gap-6 w-full">
            {tournament.rounds.map((round, roundIdx) => (
                <div key={roundIdx}>
                    <h4 className="text-sm font-bold text-indigo-300 mb-2">
                        Vòng {roundIdx + 1}
                        {roundIdx === tournament.currentRound && tournament.status === 'round_active' &&
                            <span className="ml-2 text-yellow-400 text-xs">● Đang diễn ra</span>}
                    </h4>
                    <div className="flex flex-col gap-2">
                        {round.map(match => (
                            <MatchCard
                                key={match.matchId}
                                match={match}
                                players={tournament.players}
                                onWatch={onWatch}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────
export default function TournamentLobby() {
    const { tournamentId } = useParams();
    const navigate = useNavigate();
    const currentUid = auth.currentUser?.uid;

    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [incomingChallenge, setIncomingChallenge] = useState(null); // { fromUid, fromName }
    const [sentChallengeTo, setSentChallengeTo] = useState(null); // uid
    const [challengeResult, setChallengeResult] = useState(null); // { accepted, name }
    const [view, setView] = useState('lobby'); // 'lobby' | 'bracket'
    const [champion, setChampion] = useState(null);

    const isHost = tournament?.hostUid === currentUid;
    const myPair = tournament?.acceptedPairs?.find(([a, b]) => a === currentUid || b === currentUid);
    const myPartner = myPair ? (myPair[0] === currentUid ? myPair[1] : myPair[0]) : null;
    const allPaired = tournament?.players?.length > 0 &&
        tournament.players.every(p =>
            tournament.acceptedPairs?.some(([a, b]) => a === p.uid || b === p.uid)
        );

    useEffect(() => {
        // Join tournament
        joinTournament(tournamentId);

        const onJoined = (t) => { setTournament(t); setLoading(false); };
        const onUpdated = (t) => setTournament(t);
        const onError = ({ message }) => { setError(message); setLoading(false); };
        const onChallengeReceived = ({ fromUid, fromName }) => setIncomingChallenge({ fromUid, fromName });
        const onChallengeResult = ({ targetUid, targetName, accepted }) => {
            setSentChallengeTo(null);
            setChallengeResult({ accepted, name: targetName ?? targetUid });
            setTimeout(() => setChallengeResult(null), 3000);
        };
        const onRoundStart = () => { setView('bracket'); };
        const onMatchStart = ({ roomId }) => {
            navigate(`/phaser-game/${roomId}`, { state: { mode: 'dauCap', tournamentId } });
        };
        const onChampion = ({ champion: cUid, championName }) => {
            setChampion({ uid: cUid, name: championName });
        };

        socket.on('tournament:joined', onJoined);
        socket.on('tournament:updated', onUpdated);
        socket.on('tournament:error', onError);
        socket.on('tournament:challenge_received', onChallengeReceived);
        socket.on('tournament:challenge_result', onChallengeResult);
        socket.on('tournament:round_start', onRoundStart);
        socket.on('tournament:match_start', onMatchStart);
        socket.on('tournament:champion', onChampion);

        return () => {
            socket.off('tournament:joined', onJoined);
            socket.off('tournament:updated', onUpdated);
            socket.off('tournament:error', onError);
            socket.off('tournament:challenge_received', onChallengeReceived);
            socket.off('tournament:challenge_result', onChallengeResult);
            socket.off('tournament:round_start', onRoundStart);
            socket.off('tournament:match_start', onMatchStart);
            socket.off('tournament:champion', onChampion);
        };
    }, [tournamentId, navigate]);

    const handleChallenge = useCallback((targetUid) => {
        sendChallenge(tournamentId, targetUid);
        setSentChallengeTo(targetUid);
    }, [tournamentId]);

    const handleRespondChallenge = useCallback((accepted) => {
        if (!incomingChallenge) return;
        respondChallenge(tournamentId, incomingChallenge.fromUid, accepted);
        setIncomingChallenge(null);
    }, [incomingChallenge, tournamentId]);

    const handleLeave = useCallback(() => {
        leaveTournament(tournamentId);
        navigate('/game-lobby');
    }, [tournamentId, navigate]);

    const handleStart = useCallback(() => {
        startTournament(tournamentId);
    }, [tournamentId]);

    const handleWatch = useCallback((matchId) => {
        spectateTournamentMatch(tournamentId, matchId);
        // BombGame sẽ handle spectate_joined event
    }, [tournamentId]);

    if (loading) return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
            <span className="text-white/50 text-lg">Đang tải giải đấu...</span>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-4">
            <span className="text-red-400 text-lg">{error}</span>
            <button onClick={() => navigate('/game-lobby')}
                className="text-white/70 hover:text-white underline">Quay lại</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col">
            {/* Header */}
            <div className="border-b border-white/10 px-4 py-3 flex items-center gap-3">
                <button onClick={handleLeave} className="text-white/50 hover:text-white transition-colors">
                    ← Thoát
                </button>
                <div className="flex-1">
                    <h1 className="font-bold text-lg">{tournament?.name ?? 'Đấu Cặp'}</h1>
                    <span className="text-xs text-white/40">
                        {tournament?.status === 'lobby' ? `${tournament.players.length} người trong sảnh` :
                         tournament?.status === 'round_active' ? `Đang đấu — Vòng ${(tournament.currentRound ?? 0) + 1}` :
                         'Đã kết thúc'}
                    </span>
                </div>
                {tournament?.status !== 'lobby' && (
                    <div className="flex gap-2">
                        <button onClick={() => setView('lobby')}
                            className={`text-xs px-3 py-1 rounded-full transition-colors
                                ${view === 'lobby' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                            Sảnh
                        </button>
                        <button onClick={() => setView('bracket')}
                            className={`text-xs px-3 py-1 rounded-full transition-colors
                                ${view === 'bracket' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                            Bracket
                        </button>
                    </div>
                )}
            </div>

            {/* Champion screen */}
            {champion && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 gap-4">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-3xl font-bold text-yellow-300">{champion.name}</h2>
                    <p className="text-white/70">Vô địch giải đấu!</p>
                    <button onClick={() => navigate('/game-lobby')}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-colors">
                        Về trang chủ
                    </button>
                </div>
            )}

            {/* Incoming challenge modal */}
            {incomingChallenge && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
                    <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
                        <p className="text-center text-white font-semibold">
                            <span className="text-yellow-300">{incomingChallenge.fromName}</span> muốn thách đấu với bạn!
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => handleRespondChallenge(true)}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-medium transition-colors">
                                Chấp nhận
                            </button>
                            <button onClick={() => handleRespondChallenge(false)}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors">
                                Từ chối
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Challenge result toast */}
            {challengeResult && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg
                    ${challengeResult.accepted ? 'bg-green-600 text-white' : 'bg-gray-700 text-white/80'}`}>
                    {challengeResult.accepted
                        ? `${challengeResult.name} đã chấp nhận! Đã ghép cặp.`
                        : `${challengeResult.name} đã từ chối.`}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {view === 'bracket' && (
                    <TournamentBracket tournament={tournament} onWatch={handleWatch} />
                )}

                {view === 'lobby' && (
                    <div className="max-w-lg mx-auto flex flex-col gap-4">
                        {/* Player list */}
                        <div>
                            <h3 className="text-sm text-white/50 font-semibold mb-2 uppercase tracking-wide">
                                Người chơi ({tournament?.players?.length ?? 0})
                            </h3>
                            <div className="flex flex-col gap-2">
                                {tournament?.players?.map(p => {
                                    const pairEntry = tournament.acceptedPairs?.find(([a, b]) => a === p.uid || b === p.uid);
                                    const partnerUid = pairEntry ? (pairEntry[0] === p.uid ? pairEntry[1] : pairEntry[0]) : null;
                                    const partner = partnerUid ? tournament.players.find(x => x.uid === partnerUid) : null;
                                    const isMe = p.uid === currentUid;
                                    const pendingFrom = tournament.pendingChallenges?.find(c => c.challengerUid === p.uid && c.targetUid === currentUid);
                                    const iSentTo = sentChallengeTo === p.uid;

                                    return (
                                        <div key={p.uid}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-xl border
                                                ${isMe ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/10 bg-white/5'}`}>
                                            {/* Avatar */}
                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                                                {p.photoURL ? (
                                                    <img src={p.photoURL} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                                                        {p.name?.[0]?.toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Name */}
                                            <div className="flex-1">
                                                <span className="font-medium text-sm">
                                                    {p.name}{isMe && <span className="text-indigo-400 ml-1">(bạn)</span>}
                                                    {p.uid === tournament.hostUid && <span className="text-yellow-400 ml-1">👑</span>}
                                                </span>
                                                {partner && (
                                                    <div className="text-xs text-green-400">vs {partner.name}</div>
                                                )}
                                            </div>
                                            {/* Action */}
                                            {!isMe && !partner && !myPartner && tournament.status === 'lobby' && (
                                                <button
                                                    onClick={() => !iSentTo && handleChallenge(p.uid)}
                                                    disabled={iSentTo}
                                                    className={`text-xs px-3 py-1 rounded-full transition-colors
                                                        ${iSentTo
                                                            ? 'bg-yellow-600/30 text-yellow-300 cursor-default'
                                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                                                    {iSentTo ? 'Đã gửi...' : 'Thách đấu'}
                                                </button>
                                            )}
                                            {!isMe && partner && (
                                                <span className="text-xs text-green-400/80">Đã ghép ✓</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Start button (host only) */}
                        {isHost && tournament.status === 'lobby' && (
                            <div className="flex flex-col gap-2 pt-2">
                                {!allPaired && (
                                    <p className="text-xs text-yellow-400/80 text-center">
                                        Vẫn còn người chưa ghép cặp — host vẫn có thể bắt đầu (ghép ngẫu nhiên phần còn lại)
                                    </p>
                                )}
                                <button onClick={handleStart}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500
                                        text-white font-bold py-3 rounded-xl transition-all active:scale-95">
                                    🚀 Bắt đầu giải đấu
                                </button>
                            </div>
                        )}

                        {!isHost && tournament.status === 'lobby' && (
                            <p className="text-center text-white/40 text-sm">Chờ host bắt đầu giải đấu...</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
