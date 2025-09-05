
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create users (upsert to handle existing data)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@refintel.com' },
    update: {},
    create: {
      email: 'admin@refintel.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
    },
  });

  const analyst1 = await prisma.user.upsert({
    where: { email: 'analyst1@refintel.com' },
    update: {},
    create: {
      email: 'analyst1@refintel.com',
      password: await bcrypt.hash('analyst123', 10),
      role: 'ANALYST',
      firstName: 'Sarah',
      lastName: 'Johnson',
      profilePicture: 'https://via.placeholder.com/150?text=SJ'
    },
  });

  const analyst2 = await prisma.user.upsert({
    where: { email: 'analyst2@refintel.com' },
    update: {},
    create: {
      email: 'analyst2@refintel.com',
      password: await bcrypt.hash('analyst123', 10),
      role: 'ANALYST',
      firstName: 'Michael',
      lastName: 'Chen',
      profilePicture: 'https://via.placeholder.com/150?text=MC'
    },
  });

  const charter = await prisma.user.upsert({
    where: { email: 'charter@refintel.com' },
    update: {},
    create: {
      email: 'charter@refintel.com',
      password: await bcrypt.hash('charter123', 10),
      role: 'CHARTER',
      firstName: 'David',
      lastName: 'Rodriguez',
      profilePicture: 'https://via.placeholder.com/150?text=DR'
    },
  });

  // Create teams
  const teams = [
    { name: 'Los Angeles Lakers', shortName: 'LAL', primaryColor: '#552583', secondaryColor: '#FDB927' },
    { name: 'Boston Celtics', shortName: 'BOS', primaryColor: '#007A33', secondaryColor: '#BA9653' },
    { name: 'Miami Heat', shortName: 'MIA', primaryColor: '#98002E', secondaryColor: '#F9A01B' },
    { name: 'Golden State Warriors', shortName: 'GSW', primaryColor: '#1D428A', secondaryColor: '#FFC72C' },
    { name: 'Chicago Bulls', shortName: 'CHI', primaryColor: '#CE1141', secondaryColor: '#000000' },
    { name: 'San Antonio Spurs', shortName: 'SAS', primaryColor: '#C4CED4', secondaryColor: '#000000' }
  ];

  const createdTeams = [];
  for (const team of teams) {
    const createdTeam = await prisma.team.create({
      data: {
        name: team.name,
        shortName: team.shortName,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
        logo: `https://via.placeholder.com/100?text=${team.shortName}` // Placeholder logo
      }
    });
    createdTeams.push(createdTeam);
  }

  // Create games with enhanced data
  const game1 = await prisma.game.create({
    data: {
      date: new Date('2025-01-15T19:00:00Z'),
      homeTeamId: createdTeams[0].id, // Lakers
      awayTeamId: createdTeams[5].id,  // Spurs
      status: 'COMPLETED',
      homeScore: 118,
      awayScore: 102,
      venue: 'Crypto.com Arena',
      season: '2024-25',
      gameType: 'Regular Season',
      thumbnail: 'https://via.placeholder.com/300x200?text=LAL+vs+SAS'
    },
  });

  const game2 = await prisma.game.create({
    data: {
      date: new Date('2025-01-16T20:30:00Z'),
      homeTeamId: createdTeams[1].id, // Celtics
      awayTeamId: createdTeams[2].id,  // Heat
      status: 'COMPLETED',
      homeScore: 125,
      awayScore: 119,
      venue: 'TD Garden',
      season: '2024-25',
      gameType: 'Regular Season',
      thumbnail: 'https://via.placeholder.com/300x200?text=BOS+vs+MIA'
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
