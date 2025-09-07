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

  // Create games with proper team references (using unique identifiers)
  const games = await Promise.all([
    prisma.game.upsert({
      where: { 
        id: "game-sc-vs-tx-20250115" 
      },
      update: {},
      create: {
        id: "game-sc-vs-tx-20250115",
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

    prisma.game.upsert({
      where: { 
        id: "game-duke-vs-unc-20250116" 
      },
      update: {},
      create: {
        id: "game-duke-vs-unc-20250116",
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

    prisma.game.upsert({
      where: { 
        id: "game-unc-vs-sc-20250118" 
      },
      update: {},
      create: {
        id: "game-unc-vs-sc-20250118",
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

    prisma.game.upsert({
      where: { 
        id: "game-tx-vs-duke-20250120" 
      },
      update: {},
      create: {
        id: "game-tx-vs-duke-20250120",
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

    prisma.game.upsert({
      where: { 
        id: "game-sc-vs-unc-20250122" 
      },
      update: {},
      create: {
        id: "game-sc-vs-unc-20250122",
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


  // Create multiple events for each game
  console.log('Creating events...');
  const events = [];
  const eventTypes = ["FOUL", "TECHNICAL_FOUL", "FLAGRANT_FOUL", "OFFENSIVE_FOUL", "TRAVEL", "BLOCKING_FOUL", "CHARGING_FOUL", "INTENTIONAL_FOUL", "LOOSE_BALL_FOUL", "SHOOTING_FOUL"];
  const videoUrls = [
    "https://dvsportreplay.blob.core.windows.net/wbb-clips//VIDEOS//2023-24//SEC//00%20CLIPS//LSU//LSU%20VS%20KENT%20ST%20-%2011.14.23%20-%2010-56-24//PLAY%20088%20-%20ISO2023-11-14T11.44.22.MP4",
    "https://example.com/video2.mp4",
    "https://example.com/video3.mp4",
    "https://example.com/video4.mp4",
    "https://example.com/video5.mp4"
  ];

  for (let gameIndex = 0; gameIndex < createdGames.length; gameIndex++) {
    const game = createdGames[gameIndex];
    const eventsPerGame = game.status === 'COMPLETED' ? 5 : 3; // More events for completed games

    for (let eventIndex = 0; eventIndex < eventsPerGame; eventIndex++) {
      const event = await prisma.event.upsert({
        where: { 
          id: `event-${game.id}-${eventIndex}` 
        },
        update: {},
        create: {
          id: `event-${game.id}-${eventIndex}`,
          gameId: game.id,
          timestampMs: (eventIndex + 1) * 300000 + (gameIndex * 100000), // Spread events across game time
          videoUrl: videoUrls[eventIndex % videoUrls.length],
          type: eventTypes[(gameIndex * eventsPerGame + eventIndex) % eventTypes.length]
        }
      });
      events.push(event);
    }
  }

  // Create tags
  console.log('Creating tags...');
  const tags = [];
  const tagLabels = [
    "Blocking Foul", 
    "Technical Foul - Excessive Complaining", 
    "Flagrant 1", 
    "Offensive Foul", 
    "Travel Violation",
    "Charging Foul",
    "Intentional Foul - Hard Contact",
    "Loose Ball Foul",
    "Shooting Foul - Contact on Shot",
    "Technical Foul - Unsporting Behavior"
  ];

  // Create tags for about 80% of events (some events may not have tags yet)
  const eventsToTag = Math.floor(events.length * 0.8);

  for (let i = 0; i < eventsToTag; i++) {
    const tag = await prisma.tag.upsert({
      where: { 
        id: `tag-${events[i].id}-${i}` 
      },
      update: {},
      create: {
        id: `tag-${events[i].id}-${i}`,
        eventId: events[i].id,
        createdById: charter.id, // Charter user
        label: tagLabels[i % tagLabels.length],
        notes: `Analysis note for ${events[i].type}: ${tagLabels[i % tagLabels.length]}`
      }
    });
    tags.push(tag);
  }

  // Create analyst actions
  console.log('Creating analyst actions...');
  const analystActions = [];
  for (let i = 0; i < Math.min(3, tags.length); i++) {
    const action = await prisma.analystAction.upsert({
      where: { 
        id: `action-${tags[i].id}-${i}` 
      },
      update: {},
      create: {
        id: `action-${tags[i].id}-${i}`,
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
  const assignments = await prisma.gameAssignment.createMany({
    data: [
      {
        gameId: games[0].id, // Duke vs UNC
        analystId: analyst1.id,
        priority: 'high',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      },
      {
        gameId: games[1].id, // UNC vs SC  
        analystId: analyst1.id,
        priority: 'medium'
      },
      {
        gameId: games[2].id, // TX vs Duke
        analystId: analyst1.id,
        priority: 'low'
      }
    ]
  });

  const createdEvents = events;
  const createdTags = tags;
  const createdAnalystActions = analystActions;
  const createdAssignments = assignments;

  console.log("✅ Database seeded successfully!");
  console.log(`Created ${createdUsers.length} users`);
  console.log(`Created ${createdGames.length} games`);
  console.log(`Created ${createdEvents.length} events`);
  console.log(`Created ${createdTags.length} tags`);
  console.log(`Created ${createdAnalystActions.length} analyst actions`);
  console.log(`Created ${createdAssignments.count} game assignments`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });