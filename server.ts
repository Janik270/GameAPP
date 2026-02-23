import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import cors from 'cors';
import os from 'os';
import http from 'http';
import { questionBank } from './src/data/questions';
import { mostLikelyQuestions } from './src/data/mostLikelyQuestions';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
    const server = express();
    const httpServer = createServer(server);
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    server.use(cors());

    let cachedNetworkInfo: { networkIps: string[], publicIp: string } | null = null;
    let lastIpFetch = 0;
    const IP_CACHE_TIME = 1000 * 60 * 10; // 10 minutes

    const getNetworkInfo = async (force: boolean = false) => {
        const now = Date.now();
        if (!force && cachedNetworkInfo && (now - lastIpFetch < IP_CACHE_TIME)) {
            return cachedNetworkInfo;
        }

        const interfaces = os.networkInterfaces();
        const networkIps: string[] = [];
        for (const iface in interfaces) {
            for (const details of interfaces[iface] || []) {
                if (details.family === 'IPv4' && !details.internal) {
                    networkIps.push(details.address);
                }
            }
        }

        console.log('Server: Network IPs detected:', networkIps);

        let publicIp = '';
        try {
            console.log('Server: Fetching public IP...');
            const response = await fetch('https://api.ipify.org?format=json');
            const data = (await response.json()) as { ip: string };
            publicIp = data.ip;
            console.log('Server: Public IP detected:', publicIp);
        } catch (e) {
            console.log('Server: Could not fetch public IP');
        }

        cachedNetworkInfo = { networkIps, publicIp };
        lastIpFetch = now;
        return cachedNetworkInfo;
    };

    // Game state (in-memory)
    const lobbies: Record<string, {
        hostId: string;
        players: { id: string; name: string }[];
        gameData: {
            imposterId?: string;
            answers: Record<string, string>;
            votes: Record<string, string>; // voterId -> votedPlayerId
            status: 'lobby' | 'question' | 'voting' | 'reveal' | 'finance-duel';
            currentRound: number;
            maxRounds: number;
            gameType: string;
            // Finance Duel specific
            market?: Record<string, { price: number, history: number[] }>;
            portfolios?: Record<string, { balance: number, assets: Record<string, number> }>;
            timeLeft?: number;
            duration?: number;
            timerInterval?: any;
        };
    }> = {};

    const emitHostUpdate = async (lobbyCode: string) => {
        const lobby = lobbies[lobbyCode];
        if (lobby) {
            const networkInfo = await getNetworkInfo();
            io.to(lobby.hostId).emit('host-update', {
                players: lobby.players,
                gameData: lobby.gameData,
                lobbyCode,
                networkInfo
            });
        }
    };

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('create-lobby', (data) => {
            const lobbyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            lobbies[lobbyCode] = {
                hostId: socket.id,
                players: [],
                gameData: {
                    answers: {},
                    votes: {},
                    status: 'lobby',
                    currentRound: 0,
                    maxRounds: 1,
                    gameType: ''
                }
            };
            socket.join(lobbyCode);
            // Get network info before emitting
            getNetworkInfo().then(networkInfo => {
                socket.emit('lobby-created', { lobbyCode, networkInfo });
                console.log(`Lobby ${lobbyCode} created by ${socket.id}`);
                emitHostUpdate(lobbyCode);
            });
        });

        socket.on('join-lobby', ({ lobbyCode, playerName }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby) {
                const nameExists = lobby.players.some(p => p.name.toLowerCase() === playerName.toLowerCase());
                if (nameExists) {
                    socket.emit('error', { message: 'Name already taken' });
                    return;
                }
                lobby.players.push({ id: socket.id, name: playerName });
                socket.join(lobbyCode);
                io.to(lobbyCode).emit('player-joined', { players: lobby.players });
                socket.emit('joined-success', { lobbyCode });
                console.log(`${playerName} joined lobby ${lobbyCode}`);
                emitHostUpdate(lobbyCode);
            } else {
                socket.emit('error', { message: 'Lobby not found' });
            }
        });

        socket.on('start-game', ({ lobbyCode, gameType, maxRounds }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby && lobby.hostId === socket.id) {
                lobby.gameData.status = 'question';
                lobby.gameData.maxRounds = maxRounds || 1;
                lobby.gameData.currentRound = 1;
                lobby.gameData.gameType = gameType;

                if (gameType === 'finance-duel') {
                    lobby.gameData.status = 'finance-duel';
                    lobby.gameData.duration = (maxRounds || 3) * 60; // maxRounds is used as minutes here
                    lobby.gameData.timeLeft = lobby.gameData.duration;
                    lobby.gameData.market = {
                        'BTC': { price: 50000, history: [50000] },
                        'AAPL': { price: 150, history: [150] },
                        'TSLA': { price: 200, history: [200] },
                        'GLD': { price: 1800, history: [1800] }
                    };
                    lobby.gameData.portfolios = {};
                    lobby.players.forEach(p => {
                        lobby.gameData.portfolios![p.id] = { balance: 10000, assets: {} };
                    });

                    // Start market & timer interval
                    if (lobby.gameData.timerInterval) clearInterval(lobby.gameData.timerInterval);
                    lobby.gameData.timerInterval = setInterval(() => {
                        if (!lobbies[lobbyCode]) {
                            clearInterval(lobby.gameData.timerInterval);
                            return;
                        }

                        // Update prices (random walk)
                        const market = lobby.gameData.market!;
                        Object.keys(market).forEach(symbol => {
                            const change = (Math.random() - 0.48) * 0.02; // Slightly bullish
                            market[symbol].price = Math.max(1, market[symbol].price * (1 + change));
                            market[symbol].history.push(market[symbol].price);
                            if (market[symbol].history.length > 20) market[symbol].history.shift();
                        });

                        // Update timer
                        lobby.gameData.timeLeft! -= 1;

                        if (lobby.gameData.timeLeft! <= 0) {
                            clearInterval(lobby.gameData.timerInterval);
                            lobby.gameData.status = 'reveal';

                            // Send reveal with final rankings
                            const rankings = lobby.players.map(p => {
                                const portfolio = lobby.gameData.portfolios![p.id];
                                let netWorth = portfolio.balance;
                                Object.entries(portfolio.assets).forEach(([symbol, amount]) => {
                                    netWorth += amount * market[symbol].price;
                                });
                                return { id: p.id, name: p.name, netWorth, portfolio };
                            }).sort((a, b) => b.netWorth - a.netWorth);

                            io.to(lobbyCode).emit('reveal', {
                                gameType: 'finance-duel',
                                rankings,
                                market
                            });
                        } else {
                            io.to(lobbyCode).emit('market-update', {
                                market: lobby.gameData.market,
                                timeLeft: lobby.gameData.timeLeft,
                                portfolios: lobby.gameData.portfolios
                            });
                        }
                        emitHostUpdate(lobbyCode);
                    }, 1000);

                    io.to(lobbyCode).emit('game-started', {
                        gameType: 'finance-duel',
                        market: lobby.gameData.market,
                        duration: lobby.gameData.duration,
                        portfolios: lobby.gameData.portfolios
                    });
                    emitHostUpdate(lobbyCode);
                    return;
                }

                startNewRound(lobbyCode);
            }
        });

        const startNewRound = (lobbyCode: string) => {
            const lobby = lobbies[lobbyCode];
            if (!lobby) return;

            const gameType = lobby.gameData.gameType;
            lobby.gameData.answers = {};
            lobby.gameData.votes = {};

            if (gameType === 'who-is-lying') {
                lobby.gameData.status = 'question';
                const imposterIndex = Math.floor(Math.random() * lobby.players.length);
                const imposterId = lobby.players[imposterIndex].id;
                lobby.gameData.imposterId = imposterId;

                // Select random question pair
                const questionIndex = Math.floor(Math.random() * questionBank.length);
                const selectedQuestion = questionBank[questionIndex];

                io.to(lobbyCode).emit('game-started', {
                    gameType,
                    imposterId,
                    normalQuestion: selectedQuestion.normal,
                    imposterQuestion: selectedQuestion.imposter,
                    currentRound: lobby.gameData.currentRound,
                    maxRounds: lobby.gameData.maxRounds
                });
            } else if (gameType === 'most-likely') {
                lobby.gameData.status = 'voting'; // Skip question phase
                const questionIndex = Math.floor(Math.random() * mostLikelyQuestions.length);
                const selectedQuestion = mostLikelyQuestions[questionIndex];

                io.to(lobbyCode).emit('game-started', {
                    gameType,
                    question: selectedQuestion,
                    currentRound: lobby.gameData.currentRound,
                    maxRounds: lobby.gameData.maxRounds
                });
            }
            emitHostUpdate(lobbyCode);
        };

        socket.on('next-round', ({ lobbyCode }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby && lobby.hostId === socket.id) {
                if (lobby.gameData.currentRound < lobby.gameData.maxRounds) {
                    lobby.gameData.currentRound++;
                    startNewRound(lobbyCode);
                }
            }
        });

        socket.on('submit-answer', ({ lobbyCode, answer }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby) {
                lobby.gameData.answers[socket.id] = answer;
                io.to(lobbyCode).emit('answer-submitted', { playerId: socket.id, answer });

                if (Object.keys(lobby.gameData.answers).length === lobby.players.length) {
                    lobby.gameData.status = 'voting';
                    io.to(lobbyCode).emit('all-answered', { answers: lobby.gameData.answers });
                }
                emitHostUpdate(lobbyCode);
            }
        });

        socket.on('vote-player', ({ lobbyCode, votedPlayerId }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby) {
                lobby.gameData.votes[socket.id] = votedPlayerId;
                io.to(lobbyCode).emit('player-voted', { voterId: socket.id });

                if (Object.keys(lobby.gameData.votes).length === lobby.players.length) {
                    lobby.gameData.status = 'reveal';
                    io.to(lobbyCode).emit('reveal', {
                        imposterId: lobby.gameData.imposterId,
                        votes: lobby.gameData.votes,
                        answers: lobby.gameData.answers,
                        isLastRound: lobby.gameData.currentRound === lobby.gameData.maxRounds
                    });
                }
                emitHostUpdate(lobbyCode);
            }
        });

        socket.on('buy-asset', ({ lobbyCode, symbol, amount }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby && lobby.gameData.status === 'finance-duel') {
                const portfolio = lobby.gameData.portfolios![socket.id];
                const price = lobby.gameData.market![symbol].price;
                const cost = price * amount;

                if (portfolio.balance >= cost) {
                    portfolio.balance -= cost;
                    portfolio.assets[symbol] = (portfolio.assets[symbol] || 0) + amount;
                    // Broadcast update to the specific player and host
                    socket.emit('portfolio-update', { portfolio });
                    emitHostUpdate(lobbyCode);
                }
            }
        });

        socket.on('sell-asset', ({ lobbyCode, symbol, amount }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby && lobby.gameData.status === 'finance-duel') {
                const portfolio = lobby.gameData.portfolios![socket.id];
                const currentAmount = portfolio.assets[symbol] || 0;

                if (currentAmount >= amount) {
                    const price = lobby.gameData.market![symbol].price;
                    portfolio.balance += price * amount;
                    portfolio.assets[symbol] -= amount;
                    if (portfolio.assets[symbol] === 0) delete portfolio.assets[symbol];
                    // Broadcast update to the specific player and host
                    socket.emit('portfolio-update', { portfolio });
                    emitHostUpdate(lobbyCode);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            // Handle player removal if needed
        });
    });

    server.all(/.*/, (req, res) => {
        return handle(req, res);
    });

    httpServer.listen(Number(port), '0.0.0.0', () => {
        console.log(`> Ready on http://0.0.0.0:${port}`);
    });
});
