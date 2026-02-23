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
            market?: Record<string, { price: number, history: number[], momentum: number, volatility: number }>;
            portfolios?: Record<string, { balance: number, assets: Record<string, number> }>;
            limitOrders?: { id: string, userId: string, symbol: string, type: 'buy' | 'sell', targetPrice: number, amount: number }[];
            timeLeft?: number;
            duration?: number;
            timerInterval?: any;
            news?: { message: string, symbol?: string, impact: number, time: number }[];
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
                        'BTC': { price: 50000, history: [50000], momentum: 0, volatility: 0.02 },
                        'AAPL': { price: 150, history: [150], momentum: 0, volatility: 0.01 },
                        'TSLA': { price: 200, history: [200], momentum: 0, volatility: 0.03 },
                        'GLD': { price: 1800, history: [1800], momentum: 0, volatility: 0.005 }
                    };
                    lobby.gameData.portfolios = {};
                    lobby.gameData.limitOrders = [];
                    lobby.gameData.news = [];
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

                        // Update prices (advanced simulation)
                        const market = lobby.gameData.market!;
                        const limitOrders = lobby.gameData.limitOrders!;

                        // Random News
                        if (Math.random() < 0.05) {
                            const symbols = Object.keys(market);
                            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
                            const isPositive = Math.random() > 0.5;
                            const newsMessages = [
                                isPositive ? `${symbol} unterzeichnet Mega-Deal! 🚀` : `${symbol} enttäuscht mit Quartalszahlen. 📉`,
                                isPositive ? `Analysten stufen ${symbol} auf "Strong Buy". 💎` : `Regulierungsbehörden nehmen ${symbol} ins Visier. ⚠️`,
                                isPositive ? `${symbol} kündigt bahnbrechende Innovation an! ✨` : `Großinvestor verkauft Anteile von ${symbol}. ❌`
                            ];
                            const news = {
                                message: newsMessages[Math.floor(Math.random() * newsMessages.length)],
                                symbol,
                                impact: (isPositive ? 1 : -1) * (Math.random() * 0.05 + 0.02),
                                time: Date.now()
                            };
                            lobby.gameData.news!.unshift(news);
                            if (lobby.gameData.news!.length > 5) lobby.gameData.news!.pop();

                            // Apply news impact to momentum
                            market[symbol].momentum += news.impact;
                            io.to(lobbyCode).emit('news-alert', news);
                        }

                        Object.keys(market).forEach(symbol => {
                            const asset = market[symbol];
                            // Reversion to mean for momentum
                            asset.momentum *= 0.95;

                            // Random noise + current momentum
                            const randomNoise = (Math.random() - 0.5) * asset.volatility * 2;
                            const totalChange = asset.momentum + randomNoise;

                            asset.price = Math.max(1, asset.price * (1 + totalChange));
                            asset.history.push(asset.price);
                            if (asset.history.length > 30) asset.history.shift();

                            // Execute Limit Orders
                            for (let i = limitOrders.length - 1; i >= 0; i--) {
                                const order = limitOrders[i];
                                if (order.symbol !== symbol) continue;

                                let shouldExecute = false;
                                if (order.type === 'buy' && asset.price <= order.targetPrice) shouldExecute = true;
                                if (order.type === 'sell' && asset.price >= order.targetPrice) shouldExecute = true;

                                if (shouldExecute) {
                                    const portfolio = lobby.gameData.portfolios![order.userId];
                                    if (order.type === 'buy') {
                                        const cost = asset.price * order.amount;
                                        if (portfolio.balance >= cost) {
                                            portfolio.balance -= cost;
                                            portfolio.assets[symbol] = (portfolio.assets[symbol] || 0) + order.amount;
                                            io.to(order.userId).emit('portfolio-update', { portfolio, message: `Limit-Order ausgeführt: Kaufe ${order.amount} ${symbol} @ $${asset.price.toFixed(2)}` });
                                            limitOrders.splice(i, 1);
                                        }
                                    } else {
                                        const currentAmount = portfolio.assets[symbol] || 0;
                                        if (currentAmount >= order.amount) {
                                            portfolio.balance += asset.price * order.amount;
                                            portfolio.assets[symbol] -= order.amount;
                                            if (portfolio.assets[symbol] === 0) delete portfolio.assets[symbol];
                                            io.to(order.userId).emit('portfolio-update', { portfolio, message: `Limit-Order ausgeführt: Verkaufe ${order.amount} ${symbol} @ $${asset.price.toFixed(2)}` });
                                            limitOrders.splice(i, 1);
                                        }
                                    }
                                }
                            }
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
                                portfolios: lobby.gameData.portfolios,
                                news: lobby.gameData.news,
                                limitOrders: lobby.gameData.limitOrders
                            });
                        }
                        emitHostUpdate(lobbyCode);
                    }, 1000);

                    io.to(lobbyCode).emit('game-started', {
                        gameType: 'finance-duel',
                        market: lobby.gameData.market,
                        duration: lobby.gameData.duration,
                        portfolios: lobby.gameData.portfolios,
                        news: lobby.gameData.news
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

        socket.on('set-limit-order', ({ lobbyCode, symbol, type, targetPrice, amount }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby && lobby.gameData.status === 'finance-duel') {
                const order = {
                    id: Math.random().toString(36).substring(7),
                    userId: socket.id,
                    symbol,
                    type,
                    targetPrice,
                    amount
                };
                lobby.gameData.limitOrders!.push(order);
                socket.emit('order-placed', { order });
                emitHostUpdate(lobbyCode);
            }
        });

        socket.on('cancel-limit-order', ({ lobbyCode, orderId }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby && lobby.gameData.limitOrders) {
                lobby.gameData.limitOrders = lobby.gameData.limitOrders.filter(o => o.id !== orderId);
                socket.emit('order-cancelled', { orderId });
                emitHostUpdate(lobbyCode);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    server.all(/.*/, (req, res) => {
        return handle(req, res);
    });

    httpServer.listen(Number(port), '0.0.0.0', () => {
        console.log(`> Ready on http://0.0.0.0:${port}`);
    });
});
