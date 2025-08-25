
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create users
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@refintel.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
    },
  });

  const analyst1 = await prisma.user.create({
    data: {
      email: 'analyst1@refintel.com',
      password: await bcrypt.hash('analyst123', 10),
      role: 'ANALYST',
    },
  });

  const analyst2 = await prisma.user.create({
    data: {
      email: 'analyst2@refintel.com',
      password: await bcrypt.hash('analyst123', 10),
      role: 'ANALYST',
    },
  });

  const charter = await prisma.user.create({
    data: {
      email: 'charter@refintel.com',
      password: await bcrypt.hash('charter123', 10),
      role: 'CHARTER',
    },
  });

  // Create games
  const game1 = await prisma.game.create({
    data: {
      date: new Date('2024-01-15T19:00:00Z'),
      homeTeam: 'Lakers',
      awayTeam: 'Warriors',
    },
  });

  const game2 = await prisma.game.create({
    data: {
      date: new Date('2024-01-16T20:30:00Z'),
      homeTeam: 'Celtics',
      awayTeam: 'Heat',
    },
  });

  // Create events
  const event1 = await prisma.event.create({
    data: {
      gameId: game1.id,
      timestampMs: 120000, // 2 minutes
      videoUrl: 'https://example.com/video1.mp4',
      type: 'FOUL',
    },
  });

  const event2 = await prisma.event.create({
    data: {
      gameId: game1.id,
      timestampMs: 480000, // 8 minutes
      videoUrl: 'https://example.com/video2.mp4',
      type: 'TECHNICAL_FOUL',
    },
  });

  const event3 = await prisma.event.create({
    data: {
      gameId: game2.id,
      timestampMs: 300000, // 5 minutes
      videoUrl: 'https://example.com/video3.mp4',
      type: 'FLAGRANT_FOUL',
    },
  });

  // Create tags
  const tag1 = await prisma.tag.create({
    data: {
      eventId: event1.id,
      createdById: charter.id,
      label: 'Blocking Foul',
      notes: 'Player moved into path without establishing position',
    },
  });

  const tag2 = await prisma.tag.create({
    data: {
      eventId: event2.id,
      createdById: charter.id,
      label: 'Technical Foul - Excessive Complaining',
      notes: 'Player argued call for extended period',
    },
  });

  const tag3 = await prisma.tag.create({
    data: {
      eventId: event3.id,
      createdById: charter.id,
      label: 'Flagrant 1',
      notes: 'Unnecessary contact during shot attempt',
    },
  });

  // Create analyst actions
  await prisma.analystAction.create({
    data: {
      tagId: tag1.id,
      analystId: analyst1.id,
      action: 'APPROVE',
      comment: 'Correct call, clear blocking foul',
    },
  });

  await prisma.analystAction.create({
    data: {
      tagId: tag2.id,
      analystId: analyst2.id,
      action: 'REQUEST_CHANGES',
      comment: 'Should be classified as unsportsmanlike conduct instead',
    },
  });

  await prisma.analystAction.create({
    data: {
      tagId: tag3.id,
      analystId: analyst1.id,
      action: 'APPROVE',
      comment: 'Appropriate flagrant 1 classification',
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log(`Created ${await prisma.user.count()} users`);
  console.log(`Created ${await prisma.game.count()} games`);
  console.log(`Created ${await prisma.event.count()} events`);
  console.log(`Created ${await prisma.tag.count()} tags`);
  console.log(`Created ${await prisma.analystAction.count()} analyst actions`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
