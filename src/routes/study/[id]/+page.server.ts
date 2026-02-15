import { db } from '$lib/server/db';
import { study, tree, task } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const [foundStudy] = await db
    .select()
    .from(study)
    .where(eq(study.id, params.id));

  if (!foundStudy) {
    throw error(404, 'Study not found');
  }

  const [foundTree] = await db
    .select()
    .from(tree)
    .where(eq(tree.studyId, params.id));

  const tasks = await db
    .select()
    .from(task)
    .where(eq(task.studyId, params.id));

  // Fisher-Yates shuffle for counterbalancing task order
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }

  return {
    study: foundStudy,
    tree: foundTree,
    tasks,
  };
};
