import { db } from '$lib/server/db';
import { study, tree, task, participant, response } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type TreeNode = { id: string; label: string; children: TreeNode[] };

/** Build a map of nodeId -> depth from the tree root */
function buildDepthMap(node: TreeNode, depth = 0): Map<string, number> {
	const map = new Map<string, number>();
	map.set(node.id, depth);
	for (const child of node.children) {
		for (const [id, d] of buildDepthMap(child, depth + 1)) {
			map.set(id, d);
		}
	}
	return map;
}

/** Find the shortest path length from root to a target node */
function findOptimalPathLength(node: TreeNode, targetId: string, depth = 1): number | null {
	if (node.id === targetId) return depth;
	for (const child of node.children) {
		const result = findOptimalPathLength(child, targetId, depth + 1);
		if (result !== null) return result;
	}
	return null;
}

/** Find the label for a node ID */
function findNodeLabel(node: TreeNode, targetId: string): string | null {
	if (node.id === targetId) return node.label;
	for (const child of node.children) {
		const result = findNodeLabel(child, targetId);
		if (result !== null) return result;
	}
	return null;
}

type ClickEntry = { node_id: string; action: string; ts: number };

function computeMetrics(
	clickHistory: ClickEntry[],
	optimalPathLength: number,
	expectedNodeId: string
) {
	const totalClicks = clickHistory.length;
	const uniqueNodes = new Set(clickHistory.map((c) => c.node_id)).size;
	const S = optimalPathLength; // minimum nodes needed

	// Directness: optimal / actual (1.0 = perfect)
	const directness = totalClicks > 0 ? S / totalClicks : 0;

	// Lostness: sqrt((N/S - 1)^2 + (R/N - 1)^2)
	let lostness = 0;
	if (S > 0 && uniqueNodes > 0) {
		lostness = Math.sqrt(
			Math.pow(uniqueNodes / S - 1, 2) + Math.pow(totalClicks / uniqueNodes - 1, 2)
		);
	}

	// First click correctness: was the first click on the optimal path?
	// For simplicity: check if the first click's node_id is the first node on the path to the answer
	const firstClickNodeId = clickHistory.length > 0 ? clickHistory[0].node_id : null;

	// Backtrack count: number of 'back' actions
	const backtrackCount = clickHistory.filter((c) => c.action === 'back').length;

	// Hesitation: average gap between clicks (ms)
	let avgHesitation = 0;
	if (clickHistory.length > 1) {
		const gaps = [];
		for (let i = 1; i < clickHistory.length; i++) {
			gaps.push(clickHistory[i].ts - clickHistory[i - 1].ts);
		}
		avgHesitation = gaps.reduce((a, b) => a + b, 0) / gaps.length;
	}

	return {
		totalClicks,
		uniqueNodes,
		directness: Math.round(directness * 100) / 100,
		lostness: Math.round(lostness * 100) / 100,
		firstClickNodeId,
		backtrackCount,
		avgHesitationMs: Math.round(avgHesitation)
	};
}

export const load: PageServerLoad = async ({ params }) => {
	const [foundStudy] = await db.select().from(study).where(eq(study.id, params.id));
	if (!foundStudy) throw error(404, 'Study not found');

	const [foundTree] = await db.select().from(tree).where(eq(tree.studyId, params.id));
	const tasks = await db.select().from(task).where(eq(task.studyId, params.id));
	const participants = await db
		.select()
		.from(participant)
		.where(eq(participant.studyId, params.id));
	const allResponses: (typeof response.$inferSelect & { participantName: string | null })[] = [];
	for (const p of participants) {
		const pResponses = await db
			.select()
			.from(response)
			.where(eq(response.participantId, p.id));
		for (const r of pResponses) {
			allResponses.push({ ...r, participantName: p.name });
		}
	}

	const treeNodes = foundTree.nodes as TreeNode;

	// Build per-task summaries
	const taskSummaries = tasks.map((t) => {
		const taskResponses = allResponses.filter((r) => r.taskId === t.id);
		const optimalPath = Math.min(
			...t.expectedNodeIds.map((id) => findOptimalPathLength(treeNodes, id) ?? Infinity)
		) || 1;
		const expectedLabel = t.expectedNodeIds
			.map((id) => findNodeLabel(treeNodes, id) ?? id)
			.join(', ');

		const skippedCount = taskResponses.filter((r) => r.selectedNodeId === null).length;
		const correctCount = taskResponses.filter((r) => r.isCorrect).length;
		const totalCount = taskResponses.length;
		const successRate = totalCount > 0 ? correctCount / totalCount : 0;
		const avgDuration =
			totalCount > 0
				? taskResponses.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) / totalCount
				: 0;
		const avgConfidence =
			totalCount > 0
				? taskResponses.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / totalCount
				: 0;

		// Compute detailed metrics per response
		const detailedResponses = taskResponses.map((r) => {
			const clicks = (r.clickHistory as ClickEntry[]) ?? [];
			const metrics = computeMetrics(clicks, optimalPath, t.expectedNodeIds[0]);
			const skipped = r.selectedNodeId === null;
			const clickPathSteps = clicks.map((c) => ({
				label: findNodeLabel(treeNodes, c.node_id) ?? c.node_id,
				action: c.action as 'expand' | 'back' | 'select'
			}));
			const clickPath = clickPathSteps
				.map((s) => (s.action === 'back' ? `← ${s.label}` : s.label))
				.join(' → ');
			return {
				participantName: r.participantName ?? 'Anonymous',
				selectedNodeId: r.selectedNodeId,
				selectedLabel: skipped
					? '(skipped)'
					: (findNodeLabel(treeNodes, r.selectedNodeId!) ?? r.selectedNodeId),
				skipped,
				isCorrect: r.isCorrect,
				confidence: r.confidence,
				durationMs: r.durationMs,
				timeToFirstClickMs: r.timeToFirstClickMs,
				clickPath,
				clickPathSteps,
				...metrics
			};
		});

		// Aggregate metrics
		const avgDirectness =
			totalCount > 0
				? detailedResponses.reduce((sum, r) => sum + r.directness, 0) / totalCount
				: 0;
		const avgLostness =
			totalCount > 0
				? detailedResponses.reduce((sum, r) => sum + r.lostness, 0) / totalCount
				: 0;

		return {
			id: t.id,
			prompt: t.prompt,
			expectedNodeIds: t.expectedNodeIds,
			expectedLabel,
			optimalPath,
			totalCount,
			correctCount,
			skippedCount,
			successRate: Math.round(successRate * 100),
			avgDurationMs: Math.round(avgDuration),
			avgConfidence: Math.round(avgConfidence * 10) / 10,
			avgDirectness: Math.round(avgDirectness * 100) / 100,
			avgLostness: Math.round(avgLostness * 100) / 100,
			responses: detailedResponses
		};
	});

	// Build flat rows for CSV export
	const csvRows = allResponses.map((r) => {
		const t = tasks.find((t) => t.id === r.taskId);
		const clicks = (r.clickHistory as ClickEntry[]) ?? [];
		const optimalPath = t
			? Math.min(...t.expectedNodeIds.map((id) => findOptimalPathLength(treeNodes, id) ?? Infinity)) || 1
			: 1;
		const metrics = computeMetrics(clicks, optimalPath, t?.expectedNodeIds[0] ?? '');

		return {
			participant: r.participantName ?? 'Anonymous',
			taskPrompt: t?.prompt ?? '',
			expectedNode: t?.expectedNodeIds.join(', ') ?? '',
			selectedNode: r.selectedNodeId ?? 'SKIPPED',
			isCorrect: r.selectedNodeId === null ? 'SKIPPED' : r.isCorrect,
			confidence: r.confidence,
			durationMs: r.durationMs,
			timeToFirstClickMs: r.timeToFirstClickMs,
			totalClicks: metrics.totalClicks,
			uniqueNodes: metrics.uniqueNodes,
			directness: metrics.directness,
			lostness: metrics.lostness,
			backtrackCount: metrics.backtrackCount,
			avgHesitationMs: metrics.avgHesitationMs,
			clickPath: clicks
				.map((c) => {
					const label = findNodeLabel(treeNodes, c.node_id) ?? c.node_id;
					return c.action === 'back' ? `← ${label}` : label;
				})
				.join(' → ')
		};
	});

	return {
		study: foundStudy,
		taskSummaries,
		participantCount: participants.length,
		csvRows
	};
};
