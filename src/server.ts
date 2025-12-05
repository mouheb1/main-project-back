import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PlayerManager } from './playerManager';
import { seedDatabase, prisma } from './seed';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  PlayerJoinInput,
  PlayerMoveEvent,
  QuestCompleteEvent,
} from './types';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3009', 10);

// Initialize Express app
const app = express();
app.use(cors({
  origin: '*',
  credentials: false,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    players: playerManager.getPlayerCount(),
    uptime: process.uptime(),
  });
});

// Get all teams
app.get('/api/teams', async (_req, res) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { score: 'desc' },
    });
    res.json(teams);
  } catch (error) {
    console.error('[Server] Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Update team score
app.post('/api/teams/:id/score', async (req, res) => {
  try {
    const { id } = req.params;
    const { points } = req.body;

    if (typeof points !== 'number') {
      return res.status(400).json({ error: 'Points must be a number' });
    }

    const team = await prisma.team.update({
      where: { id },
      data: { score: { increment: points } },
    });

    res.json(team);
  } catch (error) {
    console.error('[Server] Error updating team score:', error);
    res.status(500).json({ error: 'Failed to update team score' });
  }
});

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO with typed events
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialize player manager
const playerManager = new PlayerManager();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`[Server] Client connected: ${socket.id}`);

  // Handle player join
  socket.on('player:join', (data: unknown) => {
    console.log(`[Server] player:join from ${socket.id}`, data);

    // Validate player data
    const validation = playerManager.validatePlayerData(data);
    if (!validation.valid) {
      console.log(`[Server] Invalid player data: ${validation.error}`);
      socket.emit('error', validation.error || 'Invalid player data');
      return;
    }

    const playerData = data as PlayerJoinInput;

    // Check if team is already active - kick existing player if so
    const existingSocketId = playerManager.getActiveTeamSocket(playerData.color);
    if (existingSocketId && existingSocketId !== socket.id) {
      console.log(`[Server] Team ${playerData.color} already active on socket ${existingSocketId}, kicking...`);

      // Get the existing socket and kick them
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        existingSocket.emit('kicked', 'Another player from your team has connected');

        // Remove the player and broadcast their departure
        const kickedPlayer = playerManager.removePlayer(existingSocketId);
        if (kickedPlayer) {
          io.emit('player:left', kickedPlayer.odUserId);
          console.log(`[Server] Kicked player ${kickedPlayer.odUsername} from team ${playerData.color}`);
        }

        // Disconnect the socket
        existingSocket.disconnect(true);
      }
    }

    // Add player
    const player = playerManager.addPlayer(socket.id, playerData);

    // Store userId in socket data for disconnect handling
    socket.data.odUserId = playerData.odUserId;

    // Send existing players list to new player
    const existingPlayers = playerManager.getAllPlayers(socket.id);
    socket.emit('players:list', existingPlayers);
    console.log(`[Server] Sent ${existingPlayers.length} existing players to ${socket.id}`);

    // Broadcast new player to all OTHER clients
    socket.broadcast.emit('player:joined', {
      odUserId: player.odUserId,
      odUsername: player.odUsername,
      x: player.x,
      y: player.y,
      shape: player.shape,
      color: player.color,
      completedQuests: player.completedQuests,
    });
    console.log(`[Server] Broadcast player:joined for ${player.odUsername}`);
  });

  // Handle player movement
  socket.on('player:move', (data: unknown) => {
    // Validate move data
    const validation = playerManager.validateMoveData(data);
    if (!validation.valid) {
      return; // Silent fail for invalid moves
    }

    const moveData = data as PlayerMoveEvent;

    // Update position (rate limited)
    const updated = playerManager.updatePosition(socket.id, moveData);
    if (!updated) {
      return; // Rate limited or player not found
    }

    // Broadcast position to all OTHER clients
    socket.broadcast.emit('player:moved', {
      odUserId: moveData.odUserId,
      x: moveData.x,
      y: moveData.y,
    });
  });

  // Handle quest completion
  socket.on('quest:complete', (data: unknown) => {
    if (!data || typeof data !== 'object') {
      return;
    }

    const d = data as Record<string, unknown>;
    if (typeof d.odUserId !== 'string' || typeof d.odQuestId !== 'string') {
      return;
    }

    const questData = data as QuestCompleteEvent;
    const completed = playerManager.completeQuest(socket.id, questData.odQuestId);

    if (completed) {
      // Broadcast to all clients (including sender for confirmation)
      io.emit('quest:completed', {
        odUserId: questData.odUserId,
        odQuestId: questData.odQuestId,
      });
    }
  });

  // Handle ping for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Handle explicit disconnect request
  socket.on('player:disconnect', () => {
    console.log(`[Server] player:disconnect from ${socket.id}`);
    handleDisconnect(socket.id);
  });

  // Handle socket disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Server] Client disconnected: ${socket.id}, reason: ${reason}`);
    handleDisconnect(socket.id);
  });

  // Handle connection errors
  socket.on('error', (err) => {
    console.error(`[Server] Socket error for ${socket.id}:`, err);
  });
});

// Helper function to handle player disconnect
function handleDisconnect(socketId: string) {
  const player = playerManager.removePlayer(socketId);
  if (player) {
    // Broadcast to all remaining clients that this player left
    io.emit('player:left', player.odUserId);
    console.log(`[Server] Broadcast player:left for ${player.odUsername}`);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  io.close(() => {
    console.log('[Server] Socket.IO closed');
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  io.close(() => {
    console.log('[Server] Socket.IO closed');
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });
});

// Start server with database initialization
async function startServer() {
  try {
    // Run database seed on startup
    await seedDatabase();

    httpServer.listen(PORT, () => {
      console.log(`[Server] WebSocket server running on http://localhost:${PORT}`);
      console.log(`[Server] CORS enabled for: *`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
      console.log(`[Server] Teams API: http://localhost:${PORT}/api/teams`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
