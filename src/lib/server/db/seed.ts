import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { study, tree, task } from './schema';
import sampleStudy from '../../sample-study.json';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function seed() {
  console.log('Seeding database...');

  const [newStudy] = await db.insert(study).values({
    title: sampleStudy.title,
    description: sampleStudy.description,
  }).returning();

  console.log('Created study:', newStudy.id);

  await db.insert(tree).values({
    studyId: newStudy.id,
    nodes: sampleStudy.tree,
  });

  console.log('Created tree');

  for (const t of sampleStudy.tasks) {
    await db.insert(task).values({
      studyId: newStudy.id,
      prompt: t.prompt,
      expectedNodeId: t.expectedNodeId,
    });
  }

  console.log('Created', sampleStudy.tasks.length, 'tasks');
  console.log('Done! Study ID:', newStudy.id);
}

seed();
