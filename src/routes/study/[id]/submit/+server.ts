import { db } from '$lib/server/db';
import { participant, response } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	const body = await request.json();

	// 1. Create participant
	const [newParticipant] = await db
		.insert(participant)
		.values({
			studyId: params.id,
			name: body.participantName || null
		})
		.returning();

	// 2. Insert all responses
	for (const r of body.responses) {
		await db.insert(response).values({
			participantId: newParticipant.id,
			taskId: r.taskId,
			selectedNodeId: r.selectedNodeId,
			isCorrect: r.isCorrect,
			confidence: r.confidence,
			durationMs: r.durationMs,
			timeToFirstClickMs: r.timeToFirstClickMs,
			clickHistory: r.clickHistory
		});
	}

	return json({ success: true, participantId: newParticipant.id });
};
