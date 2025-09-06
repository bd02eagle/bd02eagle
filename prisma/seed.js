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

  // Create teams - Women's College Basketball
  const teams = [
    {
      name: "UConn Huskies",
      shortName: "CONN",
      primaryColor: "#000E2F",
      secondaryColor: "#C8102E",
    },
    {
      name: "South Carolina Gamecocks",
      shortName: "SC",
      primaryColor: "#73000A",
      secondaryColor: "#000000",
    },
    {
      name: "Stanford Cardinal",
      shortName: "STAN",
      primaryColor: "#8C1515",
      secondaryColor: "#FFFFFF",
    },
    {
      name: "NC State Wolfpack",
      shortName: "NCST",
      primaryColor: "#CC0000",
      secondaryColor: "#000000",
    },
    {
      name: "LSU Tigers",
      shortName: "LSU",
      primaryColor: "#461D7C",
      secondaryColor: "#FDD023",
    },
    {
      name: "Iowa Hawkeyes",
      shortName: "IOWA",
      primaryColor: "#FFCD00",
      secondaryColor: "#000000",
    },
  ];

  const createdTeams = [];
  for (const team of teams) {
    const createdTeam = await prisma.team.upsert({
      where: { name: team.name },
      update: {},
      create: {
        name: team.name,
        shortName: team.shortName,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
        logo: `https://via.placeholder.com/100?text=${team.shortName}`, // Placeholder logo
      },
    });
    createdTeams.push(createdTeam);
  }

  // Create games with enhanced data
  const game1 = await prisma.game.create({
    data: {
      date: new Date("2025-01-15T19:00:00Z"),
      homeTeamId: createdTeams[1].id, // South Carolina
      awayTeamId: createdTeams[0].id, // UConn
      status: "COMPLETED",
      homeScore: 78,
      awayScore: 72,
      venue: "Colonial Life Arena",
      season: "2024-25",
      gameType: "Regular Season",
      thumbnail: "https://via.placeholder.com/300x200?text=SC+vs+CONN",
    },
  });

  const game2 = await prisma.game.create({
    data: {
      date: new Date("2025-01-16T20:30:00Z"),
      homeTeamId: createdTeams[2].id, // Stanford
      awayTeamId: createdTeams[4].id, // LSU
      status: "COMPLETED",
      homeScore: 82,
      awayScore: 79,
      venue: "Maples Pavilion",
      season: "2024-25",
      gameType: "Regular Season",
      thumbnail: "https://via.placeholder.com/300x200?text=STAN+vs+LSU",
    },
  });

  // Create events
  const event1 = await prisma.event.create({
    data: {
      gameId: game1.id,
      timestampMs: 120000, // 2 minutes
      videoUrl:
        "https://dvsportreplay.blob.core.windows.net/wbb-clips//VIDEOS//2023-24//SEC//00 CLIPS//LSU//LSU VS KENT ST - 11.14.23 - 10-56-24//PLAY 103 - PGM2023-11-14T12.05.17.MP4",
      type: "FOUL",
    },
  });

  const event2 = await prisma.event.create({
    data: {
      gameId: game1.id,
      timestampMs: 480000, // 8 minutes
      videoUrl:
        "https://dvsportreplay.blob.core.windows.net/wbb-clips//VIDEOS//2023-24//BIG 12//00 CLIPS//OKLAHOMA//OKLAHOMA VS ORAL ROBERTS - 11.12.23 - 13-47-33//PLAY 091 - ISO2023-11-12T14.36.15.MP4",
      type: "TECHNICAL_FOUL",
    },
  });

  const event3 = await prisma.event.create({
    data: {
      gameId: game2.id,
      timestampMs: 300000, // 5 minutes
      videoUrl:
        "https://dvsportreplay.blob.core.windows.net/wbb-clips//VIDEOS//2023-24//SEC//00 CLIPS//VANDERBILT//VANDERBILT VS WESTERN KENTUCKY - 11.15.23 - 18-13-38//PLAY 107 - ISO2023-11-15T19.33.23.MP4",
      type: "FLAGRANT_FOUL",
    },
  });

  // Create tags
  const tag1 = await prisma.tag.create({
    data: {
      eventId: event1.id,
      createdById: charter.id,
      label: "Blocking Foul",
      notes: "Player moved into path without establishing position",
    },
  });

  const tag2 = await prisma.tag.create({
    data: {
      eventId: event2.id,
      createdById: charter.id,
      label: "Technical Foul - Excessive Complaining",
      notes: "Player argued call for extended period",
    },
  });

  const tag3 = await prisma.tag.create({
    data: {
      eventId: event3.id,
      createdById: charter.id,
      label: "Flagrant 1",
      notes: "Unnecessary contact during shot attempt",
    },
  });

  // Create analyst actions
  await prisma.analystAction.create({
    data: {
      tagId: tag1.id,
      analystId: analyst1.id,
      action: "APPROVE",
      comment: "Correct call, clear blocking foul",
    },
  });

  await prisma.analystAction.create({
    data: {
      tagId: tag2.id,
      analystId: analyst2.id,
      action: "REQUEST_CHANGES",
      comment: "Should be classified as unsportsmanlike conduct instead",
    },
  });

  await prisma.analystAction.create({
    data: {
      tagId: tag3.id,
      analystId: analyst1.id,
      action: "APPROVE",
      comment: "Appropriate flagrant 1 classification",
    },
  });

  console.log("✅ Database seeded successfully!");
  console.log(`Created ${await prisma.user.count()} users`);
  console.log(`Created ${await prisma.game.count()} games`);
  console.log(`Created ${await prisma.event.count()} events`);
  console.log(`Created ${await prisma.tag.count()} tags`);
  console.log(`Created ${await prisma.analystAction.count()} analyst actions`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
