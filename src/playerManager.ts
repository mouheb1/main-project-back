import {
  Player,
  PlayerWithSocket,
  PlayerJoinInput,
  PlayerMoveEvent,
  ShapeType,
  VALID_SHAPES,
  VALID_COLORS,
} from './types';

// Canvas bounds for position validation
const CANVAS_MAX_X = 2000;
const CANVAS_MAX_Y = 2000;
const CANVAS_MIN = 0;

export class PlayerManager {
  // Primary storage: socketId -> Player (each socket is independent)
  private players: Map<string, PlayerWithSocket> = new Map();

  // Track active teams: teamColor -> socketId (only one player per team)
  private activeTeams: Map<string, string> = new Map();

  // Rate limiting: socketId -> last move timestamp
  private lastMoveTime: Map<string, number> = new Map();
  private readonly MOVE_RATE_LIMIT_MS = 50; // Max one move per 50ms

  /**
   * Check if a team color is already active
   * Returns the socketId of the existing player if team is active, null otherwise
   */
  getActiveTeamSocket(teamColor: string): string | null {
    return this.activeTeams.get(teamColor) || null;
  }

  /**
   * Add a new player - each socket is INDEPENDENT
   * Primary key is socketId, NOT odUserId
   */
  addPlayer(socketId: string, data: PlayerJoinInput): PlayerWithSocket {
    const player: PlayerWithSocket = {
      socketId,
      odUserId: data.odUserId,
      odUsername: data.odUsername,
      x: data.x,
      y: data.y,
      shape: data.shape,
      color: data.color,
      completedQuests: [],
      connectedAt: new Date(),
    };

    this.players.set(socketId, player);
    // Track this team as active
    this.activeTeams.set(data.color, socketId);
    console.log(`[PlayerManager] Player added: ${data.odUsername} (socket: ${socketId}, team: ${data.color})`);
    return player;
  }

  /**
   * Remove a player by socket ID
   */
  removePlayer(socketId: string): PlayerWithSocket | undefined {
    const player = this.players.get(socketId);
    if (player) {
      this.players.delete(socketId);
      this.lastMoveTime.delete(socketId);
      // Clean up active team tracking
      if (this.activeTeams.get(player.color) === socketId) {
        this.activeTeams.delete(player.color);
      }
      console.log(`[PlayerManager] Player removed: ${player.odUsername} (socket: ${socketId}, team: ${player.color})`);
    }
    return player;
  }

  /**
   * Get player by socket ID
   */
  getPlayer(socketId: string): PlayerWithSocket | undefined {
    return this.players.get(socketId);
  }

  /**
   * Get all players (excluding a specific socket)
   */
  getAllPlayers(excludeSocketId?: string): Player[] {
    const players: Player[] = [];
    for (const [socketId, player] of this.players) {
      if (socketId !== excludeSocketId) {
        // Return only the Player interface (without socketId and connectedAt)
        players.push({
          odUserId: player.odUserId,
          odUsername: player.odUsername,
          x: player.x,
          y: player.y,
          shape: player.shape,
          color: player.color,
          completedQuests: player.completedQuests,
        });
      }
    }
    return players;
  }

  /**
   * Get player count
   */
  getPlayerCount(): number {
    return this.players.size;
  }

  /**
   * Update player position (rate limited)
   */
  updatePosition(socketId: string, data: PlayerMoveEvent): boolean {
    const player = this.players.get(socketId);
    if (!player) {
      return false;
    }

    // Rate limiting check
    const now = Date.now();
    const lastMove = this.lastMoveTime.get(socketId) || 0;
    if (now - lastMove < this.MOVE_RATE_LIMIT_MS) {
      return false; // Rate limited
    }

    // Validate position bounds
    if (!this.isValidPosition(data.x, data.y)) {
      return false;
    }

    // Update position
    player.x = data.x;
    player.y = data.y;
    this.lastMoveTime.set(socketId, now);

    return true;
  }

  /**
   * Mark quest as completed for a player
   */
  completeQuest(socketId: string, questId: string): boolean {
    const player = this.players.get(socketId);
    if (!player) {
      return false;
    }

    if (!player.completedQuests.includes(questId)) {
      player.completedQuests.push(questId);
      console.log(`[PlayerManager] Quest ${questId} completed by ${player.odUsername}`);
    }

    return true;
  }

  /**
   * Validate player join data
   */
  validatePlayerData(data: unknown): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data format' };
    }

    const d = data as Record<string, unknown>;

    // Check required fields
    if (typeof d.odUserId !== 'string' || d.odUserId.length === 0) {
      return { valid: false, error: 'Invalid userId' };
    }

    if (typeof d.odUsername !== 'string' || d.odUsername.length === 0) {
      return { valid: false, error: 'Invalid username' };
    }

    if (typeof d.x !== 'number' || typeof d.y !== 'number') {
      return { valid: false, error: 'Invalid position' };
    }

    if (!this.isValidPosition(d.x, d.y)) {
      return { valid: false, error: 'Position out of bounds' };
    }

    if (!this.isValidShape(d.shape)) {
      return { valid: false, error: 'Invalid shape' };
    }

    if (!this.isValidColor(d.color)) {
      return { valid: false, error: 'Invalid color' };
    }

    return { valid: true };
  }

  /**
   * Validate move data
   */
  validateMoveData(data: unknown): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data format' };
    }

    const d = data as Record<string, unknown>;

    if (typeof d.odUserId !== 'string') {
      return { valid: false, error: 'Invalid userId' };
    }

    if (typeof d.x !== 'number' || typeof d.y !== 'number') {
      return { valid: false, error: 'Invalid position' };
    }

    if (!this.isValidPosition(d.x, d.y)) {
      return { valid: false, error: 'Position out of bounds' };
    }

    return { valid: true };
  }

  private isValidPosition(x: number, y: number): boolean {
    return (
      typeof x === 'number' &&
      typeof y === 'number' &&
      x >= CANVAS_MIN &&
      x <= CANVAS_MAX_X &&
      y >= CANVAS_MIN &&
      y <= CANVAS_MAX_Y &&
      !isNaN(x) &&
      !isNaN(y)
    );
  }

  private isValidShape(shape: unknown): shape is ShapeType {
    return typeof shape === 'string' && VALID_SHAPES.includes(shape as ShapeType);
  }

  private isValidColor(color: unknown): boolean {
    return typeof color === 'string' && VALID_COLORS.includes(color);
  }
}
