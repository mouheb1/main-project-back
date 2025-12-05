import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create the PostgreSQL trigger for real-time score updates
// This runs on EVERY deployment to ensure the trigger exists
async function ensureTriggerExists() {
  console.log('[Seed] Ensuring PostgreSQL trigger exists...');

  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION notify_team_score_change()
    RETURNS TRIGGER AS $$
    BEGIN
      IF OLD.score IS DISTINCT FROM NEW.score THEN
        PERFORM pg_notify('team_score_updates', json_build_object(
          'team_id', NEW.id,
          'name', NEW.name,
          'old_score', OLD.score,
          'new_score', NEW.score,
          'updated_at', NEW."updatedAt"
        )::text);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;

  const createTriggerSQL = `
    DROP TRIGGER IF EXISTS team_score_change_trigger ON "Team";
    CREATE TRIGGER team_score_change_trigger
    AFTER UPDATE ON "Team"
    FOR EACH ROW
    EXECUTE FUNCTION notify_team_score_change();
  `;

  try {
    await prisma.$executeRawUnsafe(createFunctionSQL);
    await prisma.$executeRawUnsafe(createTriggerSQL);
    console.log('[Seed] PostgreSQL trigger created/updated successfully');
  } catch (error) {
    console.error('[Seed] Error creating trigger:', error);
  }
}

export async function seedDatabase() {
  try {
    console.log('[Seed] Checking database...');

    // ALWAYS ensure trigger exists on every deployment
    await ensureTriggerExists();

    // Check if teams already exist
    const existingTeams = await prisma.team.count();
    if (existingTeams > 0) {
      console.log(`[Seed] Database already has ${existingTeams} teams, skipping seed.`);
      return;
    }

    console.log('[Seed] Seeding database with teams...');

    // Create teams (synced with leader-back seeds)
    const teams = await Promise.all([
      prisma.team.upsert({
        where: { name: 'Les Gaulois Numériques' },
        update: { color: '#ef4444' },
        create: {
          name: 'Les Gaulois Numériques',
          description: 'Résistants face à l\'empire des Big Tech!',
          color: '#ef4444',
          score: 0,
        },
      }),
      prisma.team.upsert({
        where: { name: 'Libre ou Rien' },
        update: { color: '#3b82f6' },
        create: {
          name: 'Libre ou Rien',
          description: 'Pour un numérique 100% open source',
          color: '#3b82f6',
          score: 0,
        },
      }),
      prisma.team.upsert({
        where: { name: 'Les Éco-Hackers' },
        update: { color: '#22c55e' },
        create: {
          name: 'Les Éco-Hackers',
          description: 'La tech au service de la planète',
          color: '#22c55e',
          score: 0,
        },
      }),
      prisma.team.upsert({
        where: { name: 'Linux Forever' },
        update: { color: '#f59e0b' },
        create: {
          name: 'Linux Forever',
          description: 'Tux est notre mascotte!',
          color: '#f59e0b',
          score: 0,
        },
      }),
      prisma.team.upsert({
        where: { name: 'Digital Rebels' },
        update: { color: '#8b5cf6' },
        create: {
          name: 'Digital Rebels',
          description: 'Rébellion contre l\'obsolescence programmée',
          color: '#8b5cf6',
          score: 0,
        },
      }),
    ]);

    console.log(`[Seed] Created ${teams.length} teams`);

    // Create achievements (synced with leader-back seeds)
    const achievements = await Promise.all([
      prisma.achievement.upsert({
        where: { name: 'Premier Pas' },
        update: {},
        create: {
          name: 'Premier Pas',
          description: 'Rejoindre le mouvement NIRD',
          icon: 'rocket',
          points: 50,
        },
      }),
      prisma.achievement.upsert({
        where: { name: 'Explorateur' },
        update: {},
        create: {
          name: 'Explorateur',
          description: 'Compléter 5 défis',
          icon: 'compass',
          points: 100,
        },
      }),
      prisma.achievement.upsert({
        where: { name: 'Champion Linux' },
        update: {},
        create: {
          name: 'Champion Linux',
          description: 'Migrer un poste vers Linux',
          icon: 'terminal',
          points: 200,
        },
      }),
      prisma.achievement.upsert({
        where: { name: 'Résistant Numérique' },
        update: {},
        create: {
          name: 'Résistant Numérique',
          description: 'Adopter 3 logiciels libres',
          icon: 'shield',
          points: 150,
        },
      }),
      prisma.achievement.upsert({
        where: { name: 'Éco-Responsable' },
        update: {},
        create: {
          name: 'Éco-Responsable',
          description: 'Recycler du matériel informatique',
          icon: 'leaf',
          points: 100,
        },
      }),
      prisma.achievement.upsert({
        where: { name: 'Mentor' },
        update: {},
        create: {
          name: 'Mentor',
          description: 'Aider une autre équipe',
          icon: 'users',
          points: 75,
        },
      }),
    ]);

    console.log(`[Seed] Created ${achievements.length} achievements`);
    console.log('[Seed] Seeding completed!');
  } catch (error) {
    console.error('[Seed] Error:', error);
  }
}

export { prisma };
