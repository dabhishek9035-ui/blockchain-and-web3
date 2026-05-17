"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseUnits } from 'ethers';
import { backendUrl, postJson } from '../../lib/api.js';
import { getContractAddresses, getRewardDistributorContract } from '../../lib/contracts.js';
import { connectWallet } from '../../lib/wallet.js';
import Button from '../../components/Button';
import Card from '../../components/Card';

const GAME_MODES = [
  {
    id: 'rock-paper-scissors',
    title: 'Rock Paper Scissors',
    description: 'Best of five against the house. Build a winning streak to raise your reward.'
  },
  {
    id: 'reaction-sprint',
    title: 'Reaction Sprint',
    description: 'Wait for the signal, then click as fast as you can. Faster reactions score higher.'
  }
];

const RPS_CHOICES = ['rock', 'paper', 'scissors'];

function emptyRpsState() {
  return {
    round: 0,
    playerWins: 0,
    cpuWins: 0,
    draws: 0,
    finished: false,
    history: []
  };
}

function emptyReactionState() {
  return {
    phase: 'idle',
    reactionMs: null,
    score: 0,
    result: 'draw',
    message: 'Press start to begin.'
  };
}

function getRpsWinner(playerChoice, cpuChoice) {
  if (playerChoice === cpuChoice) {
    return 'draw';
  }

  const wins = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper'
  };

  return wins[playerChoice] === cpuChoice ? 'win' : 'loss';
}

function estimateRewardAmount(session) {
  if (!session) {
    return 0;
  }

  const numericScore = Number(session.score) || 0;
  const baseReward = Math.max(1, Math.floor(numericScore / 10));
  const resultBonus = session.result === 'win' ? 3 : session.result === 'draw' ? 1 : 0;
  const modeBonus = session.gameType === 'reaction-sprint' ? 1 : 2;

  return Math.min(15, baseReward + resultBonus + modeBonus);
}

export default function GamesPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [activeGame, setActiveGame] = useState('rock-paper-scissors');
  const [status, setStatus] = useState('Connect a wallet, play a round, then claim the reward.');
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [loadingClaim, setLoadingClaim] = useState(false);
  const [rewardSignature, setRewardSignature] = useState('');
  const [rewardNonce, setRewardNonce] = useState('');
  const [claimedAmount, setClaimedAmount] = useState('');
  const [completedSession, setCompletedSession] = useState(null);
  const [addresses] = useState(getContractAddresses());
  const [rpsState, setRpsState] = useState(emptyRpsState());
  const [reactionState, setReactionState] = useState(emptyReactionState());
  const reactionTimerRef = useRef(null);
  const reactionStartRef = useRef(null);

  const canUseChain = useMemo(() => Boolean(addresses.rewardDistributor), [addresses]);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) {
        window.clearTimeout(reactionTimerRef.current);
      }
    };
  }, []);

  function resetClaimState() {
    setCompletedSession(null);
    setRewardSignature('');
    setRewardNonce('');
    setClaimedAmount('');
  }

  async function connectAndStoreWallet() {
    setLoadingWallet(true);
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      localStorage.setItem('xirecWalletAddress', address);
      setStatus('Wallet connected. Pick a game mode and start playing.');
      return address;
    } finally {
      setLoadingWallet(false);
    }
  }

  function startRpsGame() {
    resetClaimState();
    setRpsState(emptyRpsState());
    setStatus('New RPS match started. First to three wins, or five rounds, ends the game.');
  }

  function finishSession(session) {
    const rewardPreview = estimateRewardAmount(session);
    setCompletedSession({ ...session, rewardPreview });
    setClaimedAmount(String(rewardPreview));
    setStatus(`${session.gameLabel} finished. You can now claim ${rewardPreview} XIREC.`);
  }

  function playRpsRound(playerChoice) {
    if (rpsState.finished) {
      return;
    }

    const cpuChoice = RPS_CHOICES[Math.floor(Math.random() * RPS_CHOICES.length)];
    const roundOutcome = getRpsWinner(playerChoice, cpuChoice);
    const nextState = {
      ...rpsState,
      round: rpsState.round + 1,
      playerWins: rpsState.playerWins + (roundOutcome === 'win' ? 1 : 0),
      cpuWins: rpsState.cpuWins + (roundOutcome === 'loss' ? 1 : 0),
      draws: rpsState.draws + (roundOutcome === 'draw' ? 1 : 0),
      history: [
        {
          round: rpsState.round + 1,
          playerChoice,
          cpuChoice,
          roundOutcome
        },
        ...rpsState.history
      ]
    };

    const finished = nextState.round >= 5 || nextState.playerWins >= 3 || nextState.cpuWins >= 3;
    nextState.finished = finished;

    const result = nextState.playerWins > nextState.cpuWins ? 'win' : nextState.playerWins < nextState.cpuWins ? 'loss' : 'draw';
    const score = Math.min(100, Math.max(0, nextState.playerWins * 20 + nextState.draws * 8 + (result === 'win' ? 10 : 0)));

    setRpsState({ ...nextState, score, result });

    setStatus(
      finished
        ? `RPS match complete. Result: ${result}.`
        : `Round ${nextState.round}: you played ${playerChoice}, house played ${cpuChoice}.`
    );

    if (finished) {
      finishSession({
        gameType: 'rock-paper-scissors',
        gameLabel: 'Rock Paper Scissors',
        result,
        score,
        roundsPlayed: nextState.round,
        summary: `${nextState.playerWins} wins, ${nextState.cpuWins} losses, ${nextState.draws} draws`
      });
    }
  }

  function startReactionGame() {
    resetClaimState();

    if (reactionTimerRef.current) {
      window.clearTimeout(reactionTimerRef.current);
    }

    reactionStartRef.current = null;
    setReactionState({
      phase: 'waiting',
      reactionMs: null,
      score: 0,
      result: 'draw',
      message: 'Get ready. The signal will appear soon.'
    });
    setStatus('Reaction Sprint started. Wait for the signal before clicking.');

    const delay = 1200 + Math.floor(Math.random() * 1800);
    reactionTimerRef.current = window.setTimeout(() => {
      reactionTimerRef.current = null;
      reactionStartRef.current = Date.now();
      setReactionState((current) => ({
        ...current,
        phase: 'ready',
        message: 'Signal live. Click now.'
      }));
      setStatus('Signal live. Click the target as fast as you can.');
    }, delay);
  }

  function handleReactionClick() {
    if (reactionState.phase === 'waiting') {
      if (reactionTimerRef.current) {
        window.clearTimeout(reactionTimerRef.current);
        reactionTimerRef.current = null;
      }

      const nextState = {
        phase: 'done',
        reactionMs: 0,
        score: 0,
        result: 'loss',
        message: 'False start. Restart and wait for the signal.'
      };

      setReactionState(nextState);
      setStatus('False start. Restart the round and wait for the signal.');
      return;
    }

    if (reactionState.phase !== 'ready' || !reactionStartRef.current) {
      return;
    }

    const reactionMs = Date.now() - reactionStartRef.current;
    const score = Math.max(1, Math.min(100, 100 - Math.floor(reactionMs / 20)));
    const result = reactionMs <= 250 ? 'win' : reactionMs <= 450 ? 'draw' : 'loss';

    const nextState = {
      phase: 'done',
      reactionMs,
      score,
      result,
      message: `Reaction time: ${reactionMs}ms`
    };

    setReactionState(nextState);
    setStatus(`Reaction Sprint complete. Your time was ${reactionMs}ms.`);
    finishSession({
      gameType: 'reaction-sprint',
      gameLabel: 'Reaction Sprint',
      result,
      score,
      roundsPlayed: 1,
      summary: `Reaction time ${reactionMs}ms`
    });
  }

  async function claimReward() {
    try {
      if (!completedSession) {
        throw new Error('Finish a game before claiming a reward.');
      }

      setLoadingClaim(true);
      setStatus('Connecting wallet...');

      const address = walletAddress || (await connectAndStoreWallet());
      if (!address) {
        throw new Error('Wallet connection failed');
      }

      if (!canUseChain) {
        throw new Error('Reward distributor address is not configured');
      }

      const rewardContract = await getRewardDistributorContract();
      const onChainNonce = await rewardContract.nonces(address);
      const rewardAmount = estimateRewardAmount(completedSession);

      setStatus('Requesting backend signature for the completed game...');
      const reward = await postJson('/api/games/reward-signature', {
        to: address,
        gameType: completedSession.gameType,
        result: completedSession.result,
        score: completedSession.score,
        roundsPlayed: completedSession.roundsPlayed || 1,
        nonce: onChainNonce.toString(),
        chainId: Number(process.env.NEXT_PUBLIC_SEPOLIA_CHAIN_ID || 11155111),
        verifyingContract: addresses.rewardDistributor,
        summary: completedSession.summary || ''
      });

      setRewardSignature(reward.signature);
      setRewardNonce(String(reward.nonce));
      setClaimedAmount(String(reward.amount || rewardAmount));

      setStatus('Submitting reward transaction on Sepolia...');
      const rewardValue = parseUnits(String(reward.amount || rewardAmount), 18);
      const tx = await rewardContract.distributeReward(address, rewardValue, onChainNonce, reward.signature);
      await tx.wait();

      setStatus(`Reward minted for ${completedSession.gameLabel}.`);
    } catch (error) {
      setStatus(error.message || 'Reward claim failed.');
    } finally {
      setLoadingClaim(false);
    }
  }

  const rewardPreview = estimateRewardAmount(completedSession);

  return (
    <main className="relative overflow-hidden px-6 py-12">
      <div className="absolute left-1/4 top-0 -z-10 h-96 w-96 rounded-full bg-cyan-500/15 blur-[120px]" />
      <div className="absolute right-1/4 top-24 -z-10 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />

      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">Games</p>
            <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">Play to earn, not just mint.</h1>
            <p className="mt-3 max-w-3xl text-slate-400">
              Pick a mini-game, finish a real round, and only then unlock the backend-authorized reward claim.
            </p>
          </div>

          <div className="glass-card flex items-center gap-3 rounded-3xl px-5 py-4">
            <div className={`h-2.5 w-2.5 rounded-full ${canUseChain ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Reward network</p>
              <p className="text-sm text-slate-200">{canUseChain ? 'Sepolia reward distributor ready' : 'Reward distributor not configured'}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="space-y-6">
            <Card>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Wallet</p>
                  <p className="mt-2 break-all font-mono text-cyan-300">{walletAddress || 'Not connected yet'}</p>
                </div>
                <Button loading={loadingWallet} onClick={connectAndStoreWallet} className="w-full lg:w-auto">
                  {walletAddress ? 'Reconnect Wallet' : 'Connect MetaMask'}
                </Button>
              </div>
            </Card>

            <Card>
              <div className="flex flex-wrap gap-3">
                {GAME_MODES.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => {
                      setActiveGame(game.id);
                      resetClaimState();
                      setStatus(`Switched to ${game.title}.`);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${activeGame === game.id ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500'}`}
                  >
                    {game.title}
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/40 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">
                      {GAME_MODES.find((game) => game.id === activeGame)?.title}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-slate-400">
                      {GAME_MODES.find((game) => game.id === activeGame)?.description}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={activeGame === 'rock-paper-scissors' ? startRpsGame : startReactionGame}>
                    Restart
                  </Button>
                </div>

                {activeGame === 'rock-paper-scissors' ? (
                  <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
                    <div>
                      <div className="grid grid-cols-3 gap-3">
                        {RPS_CHOICES.map((choice) => (
                          <button
                            key={choice}
                            onClick={() => playRpsRound(choice)}
                            disabled={rpsState.finished}
                            className="rounded-3xl border border-slate-800 bg-slate-900/70 px-4 py-5 text-left transition-transform hover:-translate-y-1 hover:border-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Pick</p>
                            <p className="mt-2 text-lg font-semibold text-white capitalize">{choice}</p>
                          </button>
                        ))}
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                        {[
                          { label: 'Round', value: `${rpsState.round}/5` },
                          { label: 'You', value: rpsState.playerWins },
                          { label: 'House', value: rpsState.cpuWins },
                          { label: 'Draws', value: rpsState.draws }
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-center">
                            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{stat.label}</p>
                            <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Match feed</p>
                      <div className="mt-4 space-y-3">
                        {rpsState.history.length === 0 ? (
                          <p className="text-sm text-slate-400">Play your first round to start building a score.</p>
                        ) : (
                          rpsState.history.map((item) => (
                            <div key={`${item.round}-${item.playerChoice}`} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                              <p className="text-sm font-semibold text-white">Round {item.round}</p>
                              <p className="mt-1 text-sm text-slate-400 capitalize">
                                You played {item.playerChoice}, the house played {item.cpuChoice}.
                              </p>
                              <p className="mt-2 text-xs uppercase tracking-[0.25em] text-cyan-300">{item.roundOutcome}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Current status</p>
                        <p className="mt-2 text-sm text-slate-300">
                          {rpsState.finished ? 'Match complete. Claim your reward from the right panel.' : 'Keep playing until someone reaches three wins or five rounds finish.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-950/40 p-6 text-center">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Reaction area</p>
                      <div className="mt-6 flex min-h-[220px] w-full items-center justify-center rounded-[2rem] border border-dashed border-slate-700 bg-slate-950/70 p-6">
                        <button
                          onClick={handleReactionClick}
                          disabled={reactionState.phase === 'idle'}
                          className={`flex h-44 w-44 items-center justify-center rounded-full border text-center text-lg font-bold transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:scale-100 ${reactionState.phase === 'ready' ? 'border-emerald-400 bg-emerald-400 text-slate-950 shadow-[0_0_40px_rgba(52,211,153,0.35)]' : reactionState.phase === 'waiting' ? 'border-amber-400 bg-amber-400/10 text-amber-300' : reactionState.phase === 'done' ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-slate-700 bg-slate-900/70 text-slate-400'}`}
                        >
                          {reactionState.phase === 'idle' && 'Start'}
                          {reactionState.phase === 'waiting' && 'Wait'}
                          {reactionState.phase === 'ready' && 'HIT NOW'}
                          {reactionState.phase === 'done' && 'Done'}
                        </button>
                      </div>
                      <div className="mt-6 grid w-full grid-cols-3 gap-4">
                        {[
                          { label: 'Score', value: reactionState.score || 0 },
                          { label: 'Time', value: reactionState.reactionMs === null ? 'n/a' : `${reactionState.reactionMs}ms` },
                          { label: 'Result', value: reactionState.result }
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-center">
                            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{stat.label}</p>
                            <p className="mt-2 text-lg font-semibold text-white capitalize">{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Session feed</p>
                      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                        <p className="text-sm font-semibold text-white">How it works</p>
                        <p className="mt-2 text-sm text-slate-400">
                          Tap start, wait for the signal, then hit the circle as fast as possible. A false start ends the round immediately.
                        </p>
                      </div>
                      <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Current status</p>
                        <p className="mt-2 text-sm text-slate-300">{reactionState.message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </section>

          <aside className="space-y-6">
            <Card>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Reward claim</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Mint only after a completed game</h3>
              <p className="mt-3 text-sm text-slate-400">
                The backend signs the reward from your actual game result, then the reward distributor contract mints the tokens.
              </p>

              <div className="mt-6 space-y-3 rounded-3xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Completed</span>
                  <span className={`font-semibold ${completedSession ? 'text-emerald-400' : 'text-rose-400'}`}>{completedSession ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Preview reward</span>
                  <span className="font-semibold text-cyan-300">{rewardPreview || 0} XIREC</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Game</span>
                  <span className="font-semibold text-white">{completedSession?.gameLabel || 'n/a'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Result</span>
                  <span className="font-semibold text-white capitalize">{completedSession?.result || 'n/a'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Score</span>
                  <span className="font-semibold text-white">{completedSession?.score ?? 'n/a'}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  className="w-full"
                  disabled={!completedSession || loadingClaim || !canUseChain}
                  loading={loadingClaim}
                  onClick={claimReward}
                >
                  Claim Backend Reward
                </Button>
                <p className="text-xs leading-relaxed text-slate-500">
                  {canUseChain ? 'The claim button stays locked until a round ends.' : 'Set the reward distributor address before claiming.'}
                </p>
              </div>
            </Card>

            <Card>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Claim details</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p className="break-all"><span className="text-slate-500">Backend:</span> {backendUrl}</p>
                <p className="break-all"><span className="text-slate-500">Reward contract:</span> {addresses.rewardDistributor || 'not set'}</p>
                <p className="break-all"><span className="text-slate-500">Nonce:</span> {rewardNonce || 'n/a'}</p>
                <p className="break-all"><span className="text-slate-500">Signature:</span> {rewardSignature || 'n/a'}</p>
                <p className="break-all"><span className="text-slate-500">Claimed amount:</span> {claimedAmount || 'n/a'} XIREC</p>
              </div>
            </Card>
          </aside>
        </div>

        <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${status.toLowerCase().includes('failed') || status.toLowerCase().includes('false start') ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300'}`}>
          {status}
        </div>
      </div>
    </main>
  );
}