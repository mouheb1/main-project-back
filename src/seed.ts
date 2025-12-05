import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedDatabase() {
  try {
    console.log('[Seed] Checking database...');

    // Check if teams already exist
    const existingTeams = await prisma.team.count();
    if (existingTeams > 0) {
      console.log(`[Seed] Database already has ${existingTeams} teams, skipping seed.`);
      return;
    }

    console.log('[Seed] Seeding database with teams...');

    // Create teams
    const teams = await Promise.all([
      prisma.team.create({
        data: {
          name: 'Les Gaulois Numériques',
          description: 'Résistants face à l\'empire des Big Tech!',
          color: '#ef4444',
          score: 0,
        },
      }),
      prisma.team.create({
        data: {
          name: 'Libre ou Rien',
          description: 'Pour un numérique 100% open source',
          color: '#3b82f6',
          score: 0,
        },
      }),
      prisma.team.create({
        data: {
          name: 'Les Éco-Hackers',
          description: 'La tech au service de la planète',
          color: '#22c55e',
          score: 0,
        },
      }),
      prisma.team.create({
        data: {
          name: 'Linux Forever',
          description: 'Tux est notre mascotte!',
          color: '#f59e0b',
          score: 0,
        },
      }),
      prisma.team.create({
        data: {
          name: 'Digital Rebels',
          description: 'Rébellion contre l\'obsolescence programmée',
          color: '#8b5cf6',
          score: 0,
        },
      }),
    ]);

    console.log(`[Seed] Created ${teams.length} teams`);
    console.log('[Seed] Seeding completed!');
  } catch (error) {
    console.error('==== error', error);
    
  }
}

export { prisma };
