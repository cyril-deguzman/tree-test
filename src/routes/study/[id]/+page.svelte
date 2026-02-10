<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Slider } from '$lib/components/ui/slider';
	import { ChevronRight, ChevronDown } from '@lucide/svelte';

	let { data } = $props();

	// Flow state: 'welcome' | 'task' | 'confidence' | 'done'
	let phase = $state<string>('welcome');
	let participantName = $state('');
	let currentTaskIndex = $state(0);
	let confidence = $state(5);

	// Tree navigation state
	type TreeNode = { id: string; label: string; children: TreeNode[] };
	let treeRoot = $derived(data.tree.nodes as TreeNode);
	let pathStack = $state<TreeNode[]>([]);
	let currentNode = $derived(pathStack[pathStack.length - 1]);

	// Task flow
	let taskStarted = $state(false);

	// Click tracking
	let taskStartTime = $state(0);
	let firstClickRecorded = $state(false);
	let timeToFirstClick = $state(0);
	let clickHistory = $state<{ node_id: string; action: string; ts: number }[]>([]);
	let selectedNodeId = $state<string | null>(null);

	// Collected responses (sent to server at the end)
	let responses = $state<any[]>([]);

	function startStudy() {
		phase = 'task';
		taskStarted = false;
	}

	function startTask() {
		// Wrapper node so root ("Home") appears as a clickable/selectable option
		const wrapper: TreeNode = {
			id: '__wrapper',
			label: '',
			children: [data.tree.nodes as TreeNode]
		};
		pathStack = [wrapper];
		selectedNodeId = null;
		taskStarted = true;
		taskStartTime = Date.now();
	}

	function recordClick(nodeId: string, action: string) {
		const ts = Date.now() - taskStartTime;
		if (!firstClickRecorded) {
			timeToFirstClick = ts;
			firstClickRecorded = true;
		}
		clickHistory.push({ node_id: nodeId, action, ts });
	}

	function expandNode(child: TreeNode) {
		recordClick(child.id, 'expand');
		pathStack = [...pathStack, child];
		selectedNodeId = child.id;
	}

	function collapseToLevel(level: number) {
		const collapsedNode = pathStack[level];
		recordClick(collapsedNode.id, 'back');
		pathStack = pathStack.slice(0, level);
		// Select the parent we collapsed to, unless it's the wrapper
		if (pathStack.length > 1) {
			selectedNodeId = pathStack[pathStack.length - 1].id;
		} else {
			selectedNodeId = null;
		}
	}

	function selectLeaf(nodeId: string) {
		recordClick(nodeId, 'select');
		selectedNodeId = nodeId;
	}

	function submitSelection() {
		phase = 'confidence';
	}

	async function submitResponses() {
		await fetch(`/study/${data.study.id}/submit`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				participantName,
				responses
			})
		});
	}

	async function advanceOrFinish() {
		if (currentTaskIndex < data.tasks.length - 1) {
			currentTaskIndex++;
			resetTask();
		} else {
			phase = 'done';
			await submitResponses();
		}
	}

	async function submitConfidence() {
		const currentTask = data.tasks[currentTaskIndex];
		responses.push({
			taskId: currentTask.id,
			selectedNodeId,
			isCorrect: selectedNodeId === currentTask.expectedNodeId,
			confidence: confidence,
			durationMs: Date.now() - taskStartTime,
			timeToFirstClickMs: timeToFirstClick,
			clickHistory: [...clickHistory]
		});

		await advanceOrFinish();
	}

	async function skipTask() {
		const currentTask = data.tasks[currentTaskIndex];
		responses.push({
			taskId: currentTask.id,
			selectedNodeId: null,
			isCorrect: false,
			confidence: null,
			durationMs: Date.now() - taskStartTime,
			timeToFirstClickMs: firstClickRecorded ? timeToFirstClick : null,
			clickHistory: [...clickHistory]
		});

		await advanceOrFinish();
	}

	function resetTask() {
		phase = 'task';
		taskStarted = false;
		pathStack = [];
		clickHistory = [];
		selectedNodeId = null;
		firstClickRecorded = false;
		timeToFirstClick = 0;
		confidence = 5;
	}
</script>

<div class="mx-auto max-w-2xl p-6">
	{#if phase === 'welcome'}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-2xl">{data.study.title}</Card.Title>
				{#if data.study.description}
					<Card.Description>{data.study.description}</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content class="space-y-4">
				<p class="text-sm text-muted-foreground">
					You'll be given {data.tasks.length} tasks. For each one, navigate the tree to find the right
					answer.
				</p>
				<div>
					<label for="name" class="text-sm font-medium">Your name (optional)</label>
					<Input id="name" bind:value={participantName} placeholder="Enter your name" />
				</div>
			</Card.Content>
			<Card.Footer>
				<Button onclick={startStudy}>Start</Button>
			</Card.Footer>
		</Card.Root>
	{:else if phase === 'task'}
		<Card.Root>
			<Card.Header>
				<div class="flex items-start justify-between">
					<div>
						<Card.Description>Task {currentTaskIndex + 1} of {data.tasks.length}</Card.Description>
						<Card.Title class="text-lg">{data.tasks[currentTaskIndex].prompt}</Card.Title>
					</div>
					{#if taskStarted}
						<button class="text-xs text-muted-foreground underline-offset-2 hover:underline" onclick={skipTask}>
							Skip
						</button>
					{/if}
				</div>
			</Card.Header>
			<Card.Content>
				{#if !taskStarted}
					<Button onclick={startTask}>Start Task</Button>
				{:else}
					{#snippet renderLevel(parentNode: TreeNode, depth: number)}
						<div class={depth > 0 ? 'ml-2 space-y-1 border-l-2 border-muted pl-3' : 'space-y-1'}>
							{#if pathStack.length > depth + 1}
								<!-- This level has an expanded node — only show it -->
								{@const expandedNode = pathStack[depth + 1]}
								{@const isDirectParent = pathStack.length === depth + 2}
								{#if isDirectParent}
									<Button
										variant={selectedNodeId === expandedNode.id ? 'default' : 'ghost'}
										size="sm"
										onclick={() => collapseToLevel(depth + 1)}
									>
										<ChevronDown class="mr-1 h-4 w-4" />
										{expandedNode.label}
									</Button>
								{:else}
									<p class="py-1 text-sm font-medium text-muted-foreground">
										<ChevronDown class="mr-1 inline h-4 w-4" />
										{expandedNode.label}
									</p>
								{/if}
								{@render renderLevel(expandedNode, depth + 1)}
							{:else}
								<!-- Deepest level — show all children -->
								{#each parentNode.children as child}
									{#if child.children.length > 0}
										<Button
											variant="ghost"
											class="w-full justify-start"
											onclick={() => expandNode(child)}
										>
											<ChevronRight class="mr-1 h-4 w-4" />
											{child.label}
										</Button>
									{:else}
										<Button
											variant={selectedNodeId === child.id ? 'default' : 'ghost'}
											class="w-full justify-start"
											onclick={() => selectLeaf(child.id)}
										>
											{child.label}
										</Button>
									{/if}
								{/each}
							{/if}
						</div>
					{/snippet}

					{@render renderLevel(pathStack[0], 0)}

					{#if selectedNodeId}
						<div class="mt-4 flex justify-end">
							<Button onclick={submitSelection}>Submit Answer</Button>
						</div>
					{/if}
				{/if}
			</Card.Content>
		</Card.Root>
	{:else if phase === 'confidence'}
		<Card.Root>
			<Card.Header>
				<Card.Title>How confident are you?</Card.Title>
				<Card.Description>Rate your confidence from 1 (guessing) to 10 (certain)</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<Slider type="single" bind:value={confidence} min={1} max={10} step={1} />
				<p class="text-center text-2xl font-bold">{confidence}</p>
			</Card.Content>
			<Card.Footer>
				<Button onclick={submitConfidence}>Next</Button>
			</Card.Footer>
		</Card.Root>
	{:else if phase === 'done'}
		<Card.Root>
			<Card.Header>
				<Card.Title>Thank you!</Card.Title>
				<Card.Description>You've completed all {data.tasks.length} tasks.</Card.Description>
			</Card.Header>
		</Card.Root>
	{/if}
</div>
