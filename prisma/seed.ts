import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 12);
  await db.user.upsert({
    where: { email: "admin@dhsecheron.com" },
    update: {},
    create: {
      email: "admin@dhsecheron.com",
      name: "Admin",
      passwordHash: adminHash,
      role: "ADMIN",
      classificationAccess: "RESTRICTED",
    },
  });

  // Create researcher user
  const researcherHash = await bcrypt.hash("researcher123", 12);
  await db.user.upsert({
    where: { email: "researcher@dhsecheron.com" },
    update: {},
    create: {
      email: "researcher@dhsecheron.com",
      name: "Researcher",
      passwordHash: researcherHash,
      role: "RESEARCHER",
      classificationAccess: "CONFIDENTIAL",
    },
  });

  // Create research areas
  const areas = [
    {
      name: "Hardfacing & Wear Resistance",
      description: "Hardfacing alloys, wear-resistant coatings, and overlay welding",
      keywords: ["hardfacing", "wear resistance", "overlay", "cladding", "chromium carbide", "tungsten carbide", "abrasion"],
    },
    {
      name: "WAAM",
      description: "Wire Arc Additive Manufacturing research",
      keywords: ["WAAM", "additive manufacturing", "wire arc", "3D printing metal", "deposition", "GMAW additive"],
    },
    {
      name: "Electrode Chemistry",
      description: "Welding electrode composition, flux design, and coating technology",
      keywords: ["electrode", "flux", "coating", "rutile", "basic", "cellulosic", "slag", "arc stability"],
    },
    {
      name: "Welding Metallurgy",
      description: "Microstructure, phase transformations, and properties of welded joints",
      keywords: ["welding metallurgy", "HAZ", "heat affected zone", "microstructure", "phase transformation", "solidification", "residual stress"],
    },
    {
      name: "Quality & Testing",
      description: "Testing standards, quality assurance, and NDT methods",
      keywords: ["testing", "quality", "NDT", "radiography", "ultrasonic", "charpy", "tensile", "bend test", "ISO", "ASTM", "AWS"],
    },
    {
      name: "Electrical Engineering",
      description: "Transformers, switchgear, and electrical equipment",
      keywords: ["transformer", "switchgear", "circuit breaker", "insulation", "dielectric", "power system"],
    },
    {
      name: "Manufacturing Processes",
      description: "Production methods, automation, and process optimization",
      keywords: ["manufacturing", "automation", "process", "lean", "productivity", "efficiency", "extrusion", "drawing"],
    },
    {
      name: "Corrosion & Protection",
      description: "Corrosion mechanisms, prevention, and protective coatings",
      keywords: ["corrosion", "protection", "coating", "passivation", "cathodic", "anodic", "galvanic", "oxidation"],
    },
  ];

  for (const area of areas) {
    await db.researchArea.upsert({
      where: { name: area.name },
      update: { description: area.description, keywords: area.keywords },
      create: area,
    });
  }

  // Seed domain-specific formulas
  const formulas = [
    {
      name: "Heat Input (IIW)",
      expression: "HI = (V × I × 60) / (S × 1000) [kJ/mm]",
      domain: "welding",
      variables: { V: "Voltage (V)", I: "Current (A)", S: "Travel speed (mm/min)" },
      description: "Calculates heat input per unit length of weld. Standard IIW method.",
    },
    {
      name: "Carbon Equivalent (IIW)",
      expression: "CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15",
      domain: "welding",
      variables: { C: "%C", Mn: "%Mn", Cr: "%Cr", Mo: "%Mo", V: "%V", Ni: "%Ni", Cu: "%Cu" },
      description: "Weldability indicator. CE > 0.45 requires preheat.",
    },
    {
      name: "Archard Wear Equation",
      expression: "V = K × F × L / H",
      domain: "wear",
      variables: { V: "Wear volume", K: "Wear coefficient", F: "Normal load", L: "Sliding distance", H: "Hardness" },
      description: "Predicts sliding wear volume loss.",
    },
  ];

  for (const formula of formulas) {
    const existing = await db.formula.findFirst({ where: { name: formula.name } });
    if (!existing) {
      await db.formula.create({ data: formula });
    }
  }

  console.log("Seed completed successfully");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
