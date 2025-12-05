// Shared type definitions for WebSocket multiplayer

export type ShapeType = 'circle' | 'square' | 'triangle' | 'star' | 'hexagon' | 'diamond';

// Valid shapes and colors for validation
export const VALID_SHAPES: ShapeType[] = ['circle', 'square', 'triangle', 'star', 'hexagon', 'diamond'];
export const VALID_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#f59e0b', // amber - team color
];

// Player data as stored on server (keyed by socket.id)
export interface Player {
  odUserId: string;
  odUsername: string;
  x: number;
  y: number;
  shape: ShapeType;
  color: string;
  completedQuests: string[];
}

// Extended player with socket info (internal use)
export interface PlayerWithSocket extends Player {
  socketId: string;
  connectedAt: Date;
}

// Data sent when player joins
export interface PlayerJoinInput {
  odUserId: string;
  odUsername: string;
  x: number;
  y: number;
  shape: ShapeType;
  color: string;
}

// Movement event - only position, no identity
export interface PlayerMoveEvent {
  odUserId: string;
  x: number;
  y: number;
  timestamp?: number;
}

// Quest completion event
export interface QuestCompleteEvent {
  odUserId: string;
  odQuestId: string;
}

// Server to client events
export interface ServerToClientEvents {
  'players:list': (players: Player[]) => void;
  'player:joined': (player: Player) => void;
  'player:moved': (data: PlayerMoveEvent) => void;
  'player:left': (odUserId: string) => void;
  'quest:completed': (data: QuestCompleteEvent) => void;
  'error': (message: string) => void;
  'kicked': (reason: string) => void;
  'pong': () => void;
}

// Client to server events
export interface ClientToServerEvents {
  'player:join': (data: PlayerJoinInput) => void;
  'player:move': (data: PlayerMoveEvent) => void;
  'player:disconnect': () => void;
  'quest:complete': (data: QuestCompleteEvent) => void;
  'ping': () => void;
}

// Socket data
export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  odUserId?: string;
}
