
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function parseTime(timeStr) {
  // Handle different time formats from CSV
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':');
    let minutes = parseInt(parts[0]);
    let seconds = parseFloat(parts[1]);
    
    // Convert to milliseconds from start of game
    // Assuming 4th period, each period is 10 minutes (600 seconds)
    // So 4th period starts at 30 minutes (1800 seconds)
    const periodStartMs = 3 * 10 * 60 * 1000; // 3 periods * 10 minutes * 60 seconds * 1000 ms
    const timeInPeriodMs = (10 * 60 - (minutes * 60 + seconds)) * 1000; // Time elapsed in period
    
    return periodStartMs + timeInPeriodMs;
  }
  return 0;
}

function mapCallCodeToEventType(callCode) {
  const mapping = {
    'SF': 'SHOOTING_FOUL',
    'PCC': 'OFFENSIVE_FOUL', 
    'OB': 'OUT_OF_BOUNDS',
    'IC': 'INCIDENTAL_CONTACT',
    'FOM': 'FOUL',
    'TM': 'TECHNICAL_FOUL',
    'BHD': 'BLOCKING_FOUL'
  };
  return mapping[callCode] || 'FOUL';
}

function mapAccuracyToDecision(accuracy) {
  // CC = Correct Call, CI = Call Incorrect, NCC = No Call Correct
  if (accuracy === 'CC') return 'APPROVE';
  if (accuracy === 'CI') return 'REQUEST_CHANGES';
  return 'APPROVE'; // Default for NCC
}

async function main() {
  console.log("🏀 Importing CSV game data...");

  // Read and parse CSV
  const csvContent = readFileSync('attached_assets/RefIntel_L5_Seed_Data__CLEANED____Oklahoma___LSU__2025-01-31__1757587097203.csv', 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Found ${records.length} records in CSV`);

  // Create users first (if they don't exist)
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
    },
  });

  // Create teams
  const oklahoma = await prisma.team.upsert({
    where: { name: 'Oklahoma Sooners' },
    update: {},
    create: {
      name: 'Oklahoma Sooners',
      shortName: 'OU',
      primaryColor: '#841617',
      secondaryColor: '#FDF2E9'
    }
  });

  const lsu = await prisma.team.upsert({
    where: { name: 'LSU Tigers' },
    update: {},
    create: {
      name: 'LSU Tigers',
      shortName: 'LSU',
      primaryColor: '#461D7C',
      secondaryColor: '#FDD023'
    }
  });

  // Create the game
  const game = await prisma.game.upsert({
    where: { id: "game-oklahoma-vs-lsu-20250131" },
    update: {},
    create: {
      id: "game-oklahoma-vs-lsu-20250131",
      date: new Date("2025-01-31T21:00:00Z"),
      homeTeamId: lsu.id, // LSU is home team
      awayTeamId: oklahoma.id, // Oklahoma is away team
      status: "COMPLETED",
      homeScore: 107, // LSU score
      awayScore: 100, // Oklahoma score
      venue: "Pete Maravich Assembly Center",
      season: "2024-25",
      gameType: "Regular Season",
      thumbnail: "https://via.placeholder.com/300x200?text=OU+vs+LSU",
    },
  });

  console.log(`Created game: ${game.id}`);

  // Process each CSV record
  const events = [];
  const tags = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    // Create event
    const timestampMs = parseTime(record.clock);
    const eventType = mapCallCodeToEventType(record.call_code);
    
    const event = await prisma.event.upsert({
      where: { id: `event-${game.id}-${i}` },
      update: {},
      create: {
        id: `event-${game.id}-${i}`,
        gameId: game.id,
        timestampMs: timestampMs,
        videoUrl: `https://example.com/video/oklahoma-lsu-${i}.mp4`,
        type: eventType
      }
    });
    
    events.push(event);

    // Create tag for the event
    const tagLabel = `${record.call_name} - ${record.official_name} (${record.official_position})`;
    const notes = record.comments ? `Official: ${record.official_name} | Position: ${record.official_position} | Comments: ${record.comments}` : `Official: ${record.official_name} | Position: ${record.official_position}`;
    
    const tag = await prisma.tag.upsert({
      where: { id: `tag-${event.id}` },
      update: {},
      create: {
        id: `tag-${event.id}`,
        eventId: event.id,
        createdById: charter.id,
        label: tagLabel,
        notes: notes
      }
    });
    
    tags.push(tag);

    // Create analyst action based on accuracy
    if (record.accuracy && record.accuracy !== '') {
      const decision = mapAccuracyToDecision(record.accuracy);
      await prisma.analystAction.upsert({
        where: { id: `action-${tag.id}` },
        update: {},
        create: {
          id: `action-${tag.id}`,
          tagId: tag.id,
          analystId: analyst1.id,
          action: decision,
          comment: `Accuracy assessment: ${record.accuracy} - ${record.call_name}`
        }
      });
    }
  }

  // Create game assignment for analyst
  await prisma.gameAssignment.upsert({
    where: {
      gameId_analystId: {
        gameId: game.id,
        analystId: analyst1.id
      }
    },
    update: {},
    create: {
      gameId: game.id,
      analystId: analyst1.id,
      priority: 'high',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    }
  });

  console.log("✅ CSV data imported successfully!");
  console.log(`Created 2 teams`);
  console.log(`Created 1 game`);
  console.log(`Created ${events.length} events`);
  console.log(`Created ${tags.length} tags`);
  console.log(`Game: Oklahoma (100) @ LSU (107) on 2025-01-31`);
}

main()
  .catch((e) => {
    console.error("❌ Error importing CSV data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
