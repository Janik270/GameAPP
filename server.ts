import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import cors from 'cors';

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

    const emitHostUpdate = (lobbyCode: string) => {
        const lobby = lobbies[lobbyCode];
        if (lobby) {
            io.to(lobby.hostId).emit('host-update', {
                players: lobby.players,
                gameData: lobby.gameData,
                lobbyCode
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
            socket.emit('lobby-created', { lobbyCode });
            console.log(`Lobby ${lobbyCode} created by ${socket.id}`);
            emitHostUpdate(lobbyCode);
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

                    io.to(lobbyCode).emit('game-started', {
                        gameType,
                        imposterId
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

    server.all('*all', (req, res) => {
        return handle(req, res);
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
