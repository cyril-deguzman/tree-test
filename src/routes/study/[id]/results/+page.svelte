<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();

	let expandedTask = $state<string | null>(null);

	function toggleTask(taskId: string) {
		expandedTask = expandedTask === taskId ? null : taskId;
	}

	function downloadCsv() {
		const headers = [
			'Participant',
			'Task',
			'Expected Node',
			'Selected Node',
			'Correct',
			'Confidence',
			'Duration (ms)',
			'Time to First Click (ms)',
			'Total Clicks',
			'Unique Nodes',
			'Directness',
			'Lostness',
			'Backtracks',
			'Avg Hesitation (ms)'
		];

		const rows = data.csvRows.map((r) =>
			[
				r.participant,
				`"${r.taskPrompt}"`,
				r.expectedNode,
				r.selectedNode,
				r.isCorrect,
				r.confidence,
				r.durationMs,
				r.timeToFirstClickMs,
				r.totalClicks,
				r.uniqueNodes,
				r.directness,
				r.lostness,
				r.backtrackCount,
				r.avgHesitationMs
			].join(',')
		);

		const csv = [headers.join(','), ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${data.study.title.replace(/\s+/g, '-').toLowerCase()}-results.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 p-6">
	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold">{data.study.title} — Results</h1>
			{#if data.study.description}
				<p class="text-sm text-muted-foreground">{data.study.description}</p>
			{/if}
		</div>
		<Button onclick={downloadCsv} variant="outline">Export CSV</Button>
	</div>

	<!-- Overview cards -->
	<div class="grid grid-cols-3 gap-4">
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>Participants</Card.Description>
				<Card.Title class="text-3xl">{data.participantCount}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>Tasks</Card.Description>
				<Card.Title class="text-3xl">{data.taskSummaries.length}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>Avg Success Rate</Card.Description>
				<Card.Title class="text-3xl">
					{#if data.taskSummaries.length > 0}
						{Math.round(
							data.taskSummaries.reduce(
								(sum: number, t: (typeof data.taskSummaries)[0]) => sum + t.successRate,
								0
							) / data.taskSummaries.length
						)}%
					{:else}
						—
					{/if}
				</Card.Title>
			</Card.Header>
		</Card.Root>
	</div>

	<!-- Per-task summaries -->
	{#each data.taskSummaries as taskSummary, i}
		<Card.Root>
			<Card.Header>
				<Card.Description>Task {i + 1}</Card.Description>
				<Card.Title class="text-lg">{taskSummary.prompt}</Card.Title>
				<p class="text-sm text-muted-foreground">
					Expected answer: <span class="font-medium">{taskSummary.expectedLabel}</span>
				</p>
			</Card.Header>
			<Card.Content>
				<!-- Metric pills -->
				<div class="mb-4 flex flex-wrap gap-3">
					<div class="text-center">
						<p class="text-2xl font-bold">{taskSummary.successRate}%</p>
						<p class="text-xs text-muted-foreground">Success</p>
					</div>
					{#if taskSummary.skippedCount > 0}
						<div class="text-center">
							<p class="text-2xl font-bold">{taskSummary.skippedCount}</p>
							<p class="text-xs text-muted-foreground">Skipped</p>
						</div>
					{/if}
					<div class="text-center">
						<p class="text-2xl font-bold">{formatDuration(taskSummary.avgDurationMs)}</p>
						<p class="text-xs text-muted-foreground">Avg Time</p>
					</div>
					<div class="text-center">
						<p class="text-2xl font-bold">{taskSummary.avgConfidence}</p>
						<p class="text-xs text-muted-foreground">Avg Confidence</p>
					</div>
					<div class="text-center">
						<p class="text-2xl font-bold">{taskSummary.avgDirectness}</p>
						<p class="text-xs text-muted-foreground">Directness</p>
					</div>
					<div class="text-center">
						<p class="text-2xl font-bold">{taskSummary.avgLostness}</p>
						<p class="text-xs text-muted-foreground">Lostness</p>
					</div>
				</div>

				<!-- Expand/collapse per-response detail -->
				{#if taskSummary.responses.length > 0}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => toggleTask(taskSummary.id)}
					>
						{expandedTask === taskSummary.id ? 'Hide' : 'Show'} individual responses ({taskSummary.totalCount})
					</Button>

					{#if expandedTask === taskSummary.id}
						<div class="mt-3">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Participant</Table.Head>
										<Table.Head>Selected</Table.Head>
										<Table.Head>Result</Table.Head>
										<Table.Head>Confidence</Table.Head>
										<Table.Head>Duration</Table.Head>
										<Table.Head>Clicks</Table.Head>
										<Table.Head>Directness</Table.Head>
										<Table.Head>Lostness</Table.Head>
										<Table.Head>Backtracks</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each taskSummary.responses as r}
										<Table.Row>
											<Table.Cell>{r.participantName}</Table.Cell>
											<Table.Cell class="max-w-30 truncate">{r.selectedLabel}</Table.Cell>
											<Table.Cell>
												{#if r.skipped}
													<Badge variant="outline">Skipped</Badge>
												{:else if r.isCorrect}
													<Badge variant="default">Correct</Badge>
												{:else}
													<Badge variant="destructive">Wrong</Badge>
												{/if}
											</Table.Cell>
											<Table.Cell>{r.skipped ? '—' : `${r.confidence}/10`}</Table.Cell>
											<Table.Cell>{formatDuration(r.durationMs ?? 0)}</Table.Cell>
											<Table.Cell>{r.totalClicks}</Table.Cell>
											<Table.Cell>{r.directness}</Table.Cell>
											<Table.Cell>{r.lostness}</Table.Cell>
											<Table.Cell>{r.backtrackCount}</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					{/if}
				{:else}
					<p class="text-sm text-muted-foreground">No responses yet.</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/each}

	{#if data.taskSummaries.length === 0}
		<Card.Root>
			<Card.Content class="py-8 text-center">
				<p class="text-muted-foreground">No tasks found for this study.</p>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
