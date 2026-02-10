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

  return {
    study: foundStudy,
    tree: foundTree,
    tasks,
  };
};
