import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import { useGame } from "./store/game";
import { useLobby } from "./store/lobby";
import { useTournament } from "./store/tournament";
import { disconnectSocket, getSocket } from "./lib/socket";
import type {
  MatchFound, MatchQuestion, MatchResult, RoundResult,
  LobbyView, LobbyProblem, LobbyRoundEnded, LobbyComplete,
  TournamentView, TournamentProblem, TournamentGameEnded, TournamentMatchOver, TournamentComplete,
} from "./lib/types";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Queue } from "./pages/Queue";
import { Duel } from "./pages/Duel";
import { Result } from "./pages/Result";
import { Profile } from "./pages/Profile";
import { Ranks } from "./pages/Ranks";
import { Leaderboard } from "./pages/Leaderboard";
import { Settings } from "./pages/Settings";
import { Practice } from "./pages/Practice";
import { Modes } from "./pages/Modes";
import { LobbyCreate } from "./pages/LobbyCreate";
import { LobbyJoin } from "./pages/LobbyJoin";
import { LobbyRoom } from "./pages/LobbyRoom";
import { TournamentCreate } from "./pages/TournamentCreate";
import { TournamentRoom } from "./pages/TournamentRoom";

export default function App() {
  const { user, loading, init } = useAuth();

  useEffect(() => {
    void init();
  }, [init]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <AuthedApp />;
}

function AuthedApp() {
  const navigate = useNavigate();
  const setUser = useAuth((s) => s.setUser);

  useEffect(() => {
    const socket = getSocket();
    const game = useGame.getState;

    const onConnectError = (err: Error) => console.error("Socket connect_error:", err.message);
    const onQueueWaiting = (p: { searchRange: number }) => {
      game().setPhase("queuing");
      game().setSearchRange(p.searchRange);
    };
    const onQueueLeft = () => {
      if (game().phase === "queuing") game().setPhase("idle");
    };
    const onMatchFound = (p: MatchFound) => {
      // Reset transient duel state from any prior match so we start clean.
      game().reset();
      game().setMatch(p);
      game().setPhase("match_found");
      navigate("/duel", { replace: true });
    };
    const onMatchCountdown = (p: { secondsLeft: number }) => {
      game().setCountdown(p.secondsLeft);
      game().setPhase("countdown");
    };
    const onMatchQuestion = (p: MatchQuestion) => {
      game().setQuestion(p);
      game().setPhase("in_duel");
      game().setCountdown(null);
    };
    const onRoundResult = (p: RoundResult) => {
      game().setRoundResult(p);
      game().setPhase("round_over");
    };
    const onOpponentSubmitted = () => game().markOpponentSubmitted();
    const onMatchResult = (p: MatchResult) => {
      game().setResult(p);
      game().setPhase("result");
      // Refresh local user ELO + stats from the result packet.
      const cur = useAuth.getState().user;
      if (cur) {
        const win = p.result === "win" ? 1 : 0;
        const loss = p.result === "loss" ? 1 : 0;
        const draw = p.result === "draw" ? 1 : 0;
        setUser({
          ...cur,
          classicElo: p.newElo,
          classicMatches: cur.classicMatches + 1,
          classicWins: cur.classicWins + win,
          classicLosses: cur.classicLosses + loss,
          classicDraws: cur.classicDraws + draw,
        });
      }
      navigate("/result", { replace: true });
    };
    const onMatchAborted = () => {
      game().reset();
      navigate("/", { replace: true });
    };
    const onServerError = (e: { code: string; message?: string }) => console.warn("Server error:", e);

    // ───── Lobby (custom FFA mode) listeners ─────
    const lobby = useLobby.getState;
    const onLobbyCreated = (p: { code: string }) => {
      navigate(`/lobby/${p.code}`, { replace: true });
    };
    const onLobbyJoined = (p: { code: string }) => {
      navigate(`/lobby/${p.code}`, { replace: true });
    };
    const onLobbyJoinFailed = (p: { reason: string }) => {
      lobby().setJoinError(p.reason);
    };
    const onLobbyState = (p: LobbyView) => {
      lobby().setView(p);
    };
    const onLobbyCountdown = (p: { secondsLeft: number }) => {
      lobby().setCountdown(p.secondsLeft);
    };
    const onLobbyRoundStarting = (_p: { round: number; rounds: number }) => {
      // Wipe prior-round state so the countdown screen renders cleanly.
      lobby().prepRound();
    };
    const onLobbyRoundStarted = (p: { round: number; rounds: number; problem: LobbyProblem; roundStartedAt: number }) => {
      lobby().setProblem(p.problem, p.roundStartedAt);
    };
    const onLobbyPlayerSubmitted = (_p: { userId: string }) => {
      // The lobby state broadcast handles full presence; this event is a hint.
    };
    const onLobbyRoundEnded = (p: LobbyRoundEnded) => {
      lobby().setRoundEnded(p);
    };
    const onLobbyComplete = (p: LobbyComplete) => {
      lobby().setComplete(p);
    };
    const onLobbyError = (p: { code: string; message?: string }) => {
      console.warn("Lobby error:", p);
      lobby().setRoomError(p);
    };

    // ───── Tournament (custom bracket) listeners ─────
    const tour = useTournament.getState;
    const onTourCreated = (p: { code: string }) => {
      navigate(`/tournament/${p.code}`, { replace: true });
    };
    const onTourJoined = (p: { code: string }) => {
      navigate(`/tournament/${p.code}`, { replace: true });
    };
    const onTourJoinFailed = (p: { reason: string }) => {
      tour().setJoinError(p.reason);
    };
    const onTourState = (p: TournamentView) => {
      tour().setView(p);
    };
    const onTourCountdown = (p: { secondsLeft: number }) => {
      tour().setCountdown(p.secondsLeft);
    };
    const onTourGameStarting = (_p: { matchId: string; game: number; bestOf: number }) => {
      tour().prepGame();
    };
    const onTourGameStarted = (p: { matchId: string; game: number; bestOf: number; problem: TournamentProblem; gameStartedAt: number }) => {
      tour().setProblem(p.problem, p.gameStartedAt);
    };
    const onTourPlayerSubmitted = (_p: { userId: string }) => {
      // Full state broadcast follows; presence-only hint.
    };
    const onTourGameEnded = (p: TournamentGameEnded) => {
      tour().setGameEnded(p);
    };
    const onTourMatchOver = (p: TournamentMatchOver) => {
      tour().setMatchOver(p);
    };
    const onTourComplete = (p: TournamentComplete) => {
      tour().setComplete(p);
    };
    const onTourError = (p: { code: string; message?: string }) => {
      console.warn("Tournament error:", p);
      tour().setRoomError(p);
    };

    socket.on("connect_error", onConnectError);
    socket.on("queue:waiting", onQueueWaiting);
    socket.on("queue:left", onQueueLeft);
    socket.on("match:found", onMatchFound);
    socket.on("match:countdown", onMatchCountdown);
    socket.on("match:question", onMatchQuestion);
    socket.on("match:roundResult", onRoundResult);
    socket.on("match:opponentSubmitted", onOpponentSubmitted);
    socket.on("match:result", onMatchResult);
    socket.on("match:aborted", onMatchAborted);
    socket.on("lobby:created", onLobbyCreated);
    socket.on("lobby:joined", onLobbyJoined);
    socket.on("lobby:join_failed", onLobbyJoinFailed);
    socket.on("lobby:state", onLobbyState);
    socket.on("lobby:countdown", onLobbyCountdown);
    socket.on("lobby:round_starting", onLobbyRoundStarting);
    socket.on("lobby:round_started", onLobbyRoundStarted);
    socket.on("lobby:player_submitted", onLobbyPlayerSubmitted);
    socket.on("lobby:round_ended", onLobbyRoundEnded);
    socket.on("lobby:complete", onLobbyComplete);
    socket.on("lobby:error", onLobbyError);
    socket.on("tournament:created", onTourCreated);
    socket.on("tournament:joined", onTourJoined);
    socket.on("tournament:join_failed", onTourJoinFailed);
    socket.on("tournament:state", onTourState);
    socket.on("tournament:countdown", onTourCountdown);
    socket.on("tournament:game_starting", onTourGameStarting);
    socket.on("tournament:game_started", onTourGameStarted);
    socket.on("tournament:player_submitted", onTourPlayerSubmitted);
    socket.on("tournament:game_ended", onTourGameEnded);
    socket.on("tournament:match_over", onTourMatchOver);
    socket.on("tournament:complete", onTourComplete);
    socket.on("tournament:error", onTourError);
    socket.on("error", onServerError);

    return () => {
      // Targeted .off() — do NOT call removeAllListeners, that nukes socket.io
      // internals and breaks reconnect/handshake.
      socket.off("connect_error", onConnectError);
      socket.off("queue:waiting", onQueueWaiting);
      socket.off("queue:left", onQueueLeft);
      socket.off("match:found", onMatchFound);
      socket.off("match:countdown", onMatchCountdown);
      socket.off("match:question", onMatchQuestion);
      socket.off("match:roundResult", onRoundResult);
      socket.off("match:opponentSubmitted", onOpponentSubmitted);
      socket.off("match:result", onMatchResult);
      socket.off("match:aborted", onMatchAborted);
      socket.off("lobby:created", onLobbyCreated);
      socket.off("lobby:joined", onLobbyJoined);
      socket.off("lobby:join_failed", onLobbyJoinFailed);
      socket.off("lobby:state", onLobbyState);
      socket.off("lobby:countdown", onLobbyCountdown);
      socket.off("lobby:round_starting", onLobbyRoundStarting);
      socket.off("lobby:round_started", onLobbyRoundStarted);
      socket.off("lobby:player_submitted", onLobbyPlayerSubmitted);
      socket.off("lobby:round_ended", onLobbyRoundEnded);
      socket.off("lobby:complete", onLobbyComplete);
      socket.off("lobby:error", onLobbyError);
      socket.off("tournament:created", onTourCreated);
      socket.off("tournament:joined", onTourJoined);
      socket.off("tournament:join_failed", onTourJoinFailed);
      socket.off("tournament:state", onTourState);
      socket.off("tournament:countdown", onTourCountdown);
      socket.off("tournament:game_starting", onTourGameStarting);
      socket.off("tournament:game_started", onTourGameStarted);
      socket.off("tournament:player_submitted", onTourPlayerSubmitted);
      socket.off("tournament:game_ended", onTourGameEnded);
      socket.off("tournament:match_over", onTourMatchOver);
      socket.off("tournament:complete", onTourComplete);
      socket.off("tournament:error", onTourError);
      socket.off("error", onServerError);
    };
  }, [navigate, setUser]);

  // Disconnect socket when user logs out
  useEffect(() => {
    return () => {
      if (!useAuth.getState().user) disconnectSocket();
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/queue" element={<Queue />} />
      <Route path="/duel" element={<Duel />} />
      <Route path="/result" element={<Result />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/ranks" element={<Ranks />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/practice" element={<Practice />} />
      <Route path="/modes" element={<Modes />} />
      <Route path="/lobby/new" element={<LobbyCreate />} />
      <Route path="/lobby/join" element={<LobbyJoin />} />
      <Route path="/lobby/:code" element={<LobbyRoom />} />
      <Route path="/tournament/new" element={<TournamentCreate />} />
      <Route path="/tournament/:code" element={<TournamentRoom />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
