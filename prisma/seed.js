import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create users (upsert to handle existing data)
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@refintel.com" },
    update: {},
    create: {
      email: "admin@refintel.com",
      password: await bcrypt.hash("admin123", 10),
      role: "ADMIN",
    },
  });

  const analyst1 = await prisma.user.upsert({
    where: { email: "analyst1@refintel.com" },
    update: {},
    create: {
      email: "analyst1@refintel.com",
      password: await bcrypt.hash("analyst123", 10),
      role: "ANALYST",
      firstName: "Sarah",
      lastName: "Johnson",
      profilePicture: "https://via.placeholder.com/150?text=SJ",
    },
  });

  const analyst2 = await prisma.user.upsert({
    where: { email: "analyst2@refintel.com" },
    update: {},
    create: {
      email: "analyst2@refintel.com",
      password: await bcrypt.hash("analyst123", 10),
      role: "ANALYST",
      firstName: "Michael",
      lastName: "Chen",
      profilePicture: "https://via.placeholder.com/150?text=MC",
    },
  });

  const charter = await prisma.user.upsert({
    where: { email: "charter@refintel.com" },
    update: {},
    create: {
      email: "charter@refintel.com",
      password: await bcrypt.hash("charter123", 10),
      role: "CHARTER",
      firstName: "David",
      lastName: "Rodriguez",
      profilePicture: "https://via.placeholder.com/150?text=DR",
    },
  });

  const createdUsers = [adminUser, analyst1, analyst2, charter];


  // Create teams first
  const teams = await Promise.all([
    prisma.team.upsert({
      where: { name: 'South Carolina Gamecocks' },
      update: {},
      create: {
        name: 'South Carolina Gamecocks',
        shortName: 'SC',
        primaryColor: '#73000A',
        secondaryColor: '#000000'
      }
    }),
    prisma.team.upsert({
      where: { name: 'Texas Longhorns' },
      update: {},
      create: {
        name: 'Texas Longhorns',
        shortName: 'TX',
        primaryColor: '#BF5700',
        secondaryColor: '#FFFFFF'
      }
    }),
    prisma.team.upsert({
      where: { name: 'Duke Blue Devils' },
      update: {},
      create: {
        name: 'Duke Blue Devils',
        shortName: 'DUKE',
        primaryColor: '#001A57',
        secondaryColor: '#FFFFFF'
      }
    }),
    prisma.team.upsert({
      where: { name: 'North Carolina Tar Heels' },
      update: {},
      create: {
        name: 'North Carolina Tar Heels',
        shortName: 'UNC',
        primaryColor: '#4B9CD3',
        secondaryColor: '#FFFFFF'
      }
    })
  ]);

  console.log(`Created ${teams.length} teams`);

  // Create games with proper team references
  const games = await Promise.all([
    prisma.game.create({
      data: {
        date: new Date("2025-01-15T19:00:00Z"),
        homeTeamId: teams[0].id, // South Carolina
        awayTeamId: teams[1].id, // Texas Longhorns
        status: "COMPLETED",
        homeScore: 78,
        awayScore: 72,
        venue: "Colonial Life Arena",
        season: "2024-25",
        gameType: "Regular Season",
        thumbnail: "https://via.placeholder.com/300x200?text=SC+vs+TX",
      },
    }),

    prisma.game.create({
      data: {
        date: new Date("2025-01-16T20:30:00Z"),
        homeTeamId: teams[2].id, // Duke Blue Devils
        awayTeamId: teams[3].id, // North Carolina Tar Heels
        status: "COMPLETED",
        homeScore: 82,
        awayScore: 79,
        venue: "Cameron Indoor Stadium",
        season: "2024-25",
        gameType: "Regular Season",
        thumbnail: "https://via.placeholder.com/300x200?text=DUKE+vs+UNC",
      },
    }),

    prisma.game.create({
      data: {
        date: new Date("2025-01-18T21:00:00Z"),
        homeTeamId: teams[3].id, // North Carolina Tar Heels
        awayTeamId: teams[0].id, // South Carolina Gamecocks
        status: "COMPLETED",
        homeScore: 85,
        awayScore: 71,
        venue: "Dean Smith Center",
        season: "2024-25",
        gameType: "Regular Season",
        thumbnail: "https://via.placeholder.com/300x200?text=UNC+vs+SC",
      },
    }),

    prisma.game.create({
      data: {
        date: new Date("2025-01-20T18:00:00Z"),
        homeTeamId: teams[1].id, // Texas Longhorns
        awayTeamId: teams[2].id, // Duke Blue Devils
        status: "SCHEDULED",
        venue: "Moody Center",
        season: "2024-25",
        gameType: "Regular Season",
        thumbnail: "https://via.placeholder.com/300x200?text=TX+vs+DUKE",
      },
    }),

    prisma.game.create({
      data: {
        date: new Date("2025-01-22T19:30:00Z"),
        homeTeamId: teams[0].id, // South Carolina Gamecocks
        awayTeamId: teams[3].id, // North Carolina Tar Heels
        status: "SCHEDULED",
        venue: "Colonial Life Arena",
        season: "2024-25",
        gameType: "Regular Season",
        thumbnail: "https://via.placeholder.com/300x200?text=SC+vs+UNC",
      },
    }),
  ]);

  const createdGames = games;


  // Create events for each game
  console.log('Creating events...');
  const events = [];
  const eventTypes = ["FOUL", "TECHNICAL_FOUL", "FLAGRANT_FOUL", "OFFENSIVE_FOUL", "TRAVEL"];
  for (let i = 0; i < createdGames.length; i++) {
    const event = await prisma.event.create({
      data: {
        gameId: createdGames[i].id,
        timestampMs: Math.floor(Math.random() * 3600000), // Random timestamp within an hour
        videoUrl: `https://example.com/video${i + 1}.mp4`,
        type: eventTypes[Math.floor(Math.random() * eventTypes.length)]
      }
    });
    events.push(event);
  }

  // Create tags
  console.log('Creating tags...');
  const tags = [];
  const tagLabels = ["Blocking Foul", "Technical Foul - Excessive Complaining", "Flagrant 1", "Offensive Foul", "Travel Violation"];
  for (let i = 0; i < events.length; i++) {
    const tag = await prisma.tag.create({
      data: {
        eventId: events[i].id,
        createdById: charter.id, // Charter user
        label: tagLabels[Math.floor(Math.random() * tagLabels.length)],
        notes: `Analysis note ${i + 1}`
      }
    });
    tags.push(tag);
  }

  // Create analyst actions
  console.log('Creating analyst actions...');
  const analystActions = [];
  for (let i = 0; i < Math.min(3, tags.length); i++) {
    const action = await prisma.analystAction.create({
      data: {
        tagId: tags[i].id,
        analystId: analyst1.id, // Analyst user
        action: i % 2 === 0 ? 'APPROVE' : 'REQUEST_CHANGES',
        comment: `Analyst feedback ${i + 1}`
      }
    });
    analystActions.push(action);
  }

  // Create game assignments
  console.log('Creating game assignments...');
  const gameAssignments = [];
  for (let i = 0; i < Math.min(3, createdGames.length); i++) {
    const assignment = await prisma.gameAssignment.create({
      data: {
        gameId: createdGames[i].id,
        analystId: analyst1.id, // Analyst user
        priority: ['high', 'medium', 'low'][i % 3],
        dueDate: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000) // Due in 1-3 days
      }
    });
    gameAssignments.push(assignment);
  }

  const createdEvents = events;
  const createdTags = tags;
  const createdAnalystActions = analystActions;
  const createdAssignments = gameAssignments;

  console.log("✅ Database seeded successfully!");
  console.log(`Created ${createdUsers.length} users`);
  console.log(`Created ${createdGames.length} games`);
  console.log(`Created ${createdEvents.length} events`);
  console.log(`Created ${createdTags.length} tags`);
  console.log(`Created ${createdAnalystActions.length} analyst actions`);
  console.log(`Created ${createdAssignments.length} game assignments`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });