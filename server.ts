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
            status: 'lobby' | 'question' | 'voting' | 'reveal';
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
                    status: 'lobby'
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

        socket.on('start-game', ({ lobbyCode, gameType }) => {
            const lobby = lobbies[lobbyCode];
            if (lobby && lobby.hostId === socket.id) {
                lobby.gameData.status = 'question';

                if (gameType === 'who-is-lying') {
                    const imposterIndex = Math.floor(Math.random() * lobby.players.length);
                    const imposterId = lobby.players[imposterIndex].id;
                    lobby.gameData.imposterId = imposterId;
                    lobby.gameData.answers = {};
                    lobby.gameData.votes = {};

                    // Select random question pair
                    const questionIndex = Math.floor(Math.random() * questionBank.length);
                    const selectedQuestion = questionBank[questionIndex];

                    io.to(lobbyCode).emit('game-started', {
                        gameType,
                        imposterId,
                        normalQuestion: selectedQuestion.normal,
                        imposterQuestion: selectedQuestion.imposter
                    });
                } else if (gameType === 'most-likely') {
                    const questionIndex = Math.floor(Math.random() * mostLikelyQuestions.length);
                    const selectedQuestion = mostLikelyQuestions[questionIndex];

                    lobby.gameData.status = 'voting'; // Skip question phase
                    lobby.gameData.answers = {};
                    lobby.gameData.votes = {};

                    io.to(lobbyCode).emit('game-started', {
                        gameType,
                        question: selectedQuestion
                    });
                }
                emitHostUpdate(lobbyCode);
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
                        answers: lobby.gameData.answers
                    });
                }
                emitHostUpdate(lobbyCode);
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
