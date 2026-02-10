<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Slider } from '$lib/components/ui/slider';
	import { ChevronRight, ArrowLeft, Check } from '@lucide/svelte';

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
		pathStack = [data.tree.nodes as TreeNode];
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
	}

	function goBack() {
		if (pathStack.length > 1) {
			recordClick(currentNode.id, 'back');
			pathStack = pathStack.slice(0, -1);
		}
	}

	function selectNode(nodeId: string) {
		recordClick(nodeId, 'select');
		selectedNodeId = nodeId;
		phase = 'confidence';
	}

	function submitConfidence() {
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

		// Move to next task or finish
		if (currentTaskIndex < data.tasks.length - 1) {
			currentTaskIndex++;
			resetTask();
		} else {
			phase = 'done';
			// TODO: submit responses to server
		}
	}

	function resetTask() {
		phase = 'task';
		pathStack = [treeRoot];
		clickHistory = [];
		selectedNodeId = null;
		firstClickRecorded = false;
		timeToFirstClick = 0;
		confidence = 5;
		taskStartTime = Date.now();
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
				<Card.Description>Task {currentTaskIndex + 1} of {data.tasks.length}</Card.Description>
				<Card.Title class="text-lg">{data.tasks[currentTaskIndex].prompt}</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="mb-2 text-sm text-muted-foreground">
					{pathStack.map((n) => n.label).join(' > ')}
				</p>
				{#if pathStack.length > 1}
					<Button variant="ghost" size="sm" onclick={goBack} class="mb-2">
						<ArrowLeft class="mr-1 h-4 w-4" />
						Back
					</Button>
				{/if}
				<div class="space-y-1">
					{#each currentNode.children as child}
						<div class="flex items-center gap-2">
							{#if child.children.length > 0}
								<Button
									variant="ghost"
									class="w-full justify-start"
									onclick={() => expandNode(child)}
								>
									{child.label}
									<ChevronRight class="ml-auto h-4 w-4" />
								</Button>
								<Button variant="outline" size="sm" onclick={() => selectNode(child.id)}>
									<Check class="h-4 w-4" />
								</Button>
							{:else}
								<Button
									variant="ghost"
									class="w-full justify-start"
									onclick={() => selectNode(child.id)}
								>
									{child.label}
								</Button>
							{/if}
						</div>
					{/each}
				</div>
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
