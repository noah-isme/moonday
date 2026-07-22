<script lang="ts">
	import { onMount } from 'svelte';
	import { memoryStore, type Memory } from '$lib/stores/memory.svelte';

	let searchQuery = $state('');
	let selectedType = $state<string>('all');

	// Track which memory is currently being edited
	let editingId = $state<string | null>(null);
	let recentlyDeleted = $state<Memory | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | null = null;
	let editForm = $state<{
		title: string;
		content: string;
		type: Memory['type'];
		importance: number;
	}>({
		title: '',
		content: '',
		type: 'preference',
		importance: 5
	});

	onMount(() => {
		void memoryStore.loadMemories();
	});

	// Get unique memory types present
	const memoryTypes: { value: string; label: string }[] = [
		{ value: 'all', label: 'All Categories' },
		{ value: 'core_memory', label: 'Core Memories' },
		{ value: 'preference', label: 'Preferences' },
		{ value: 'emotional_pattern', label: 'Emotional Patterns' },
		{ value: 'project_memory', label: 'Project Context' },
		{ value: 'relationship_context', label: 'Relationship' },
		{ value: 'personal_goal', label: 'Personal Goals' },
		{ value: 'recurring_problem', label: 'Recurring Problems' },
		{ value: 'reflection', label: 'Reflections' }
	];

	// Filtered memories list based on search and type selector
	let filteredMemories = $derived.by(() => {
		let list = memoryStore.list;

		if (selectedType !== 'all') {
			list = list.filter((m) => m.type === selectedType);
		}

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			list = list.filter(
				(m) =>
					m.title.toLowerCase().includes(query) ||
					m.content.toLowerCase().includes(query) ||
					m.type.toLowerCase().includes(query)
			);
		}

		return list;
	});

	function startEdit(memory: Memory) {
		editingId = memory.id;
		editForm = {
			title: memory.title,
			content: memory.content,
			type: memory.type,
			importance: memory.importance
		};
	}

	function cancelEdit() {
		editingId = null;
	}

	function saveEdit(id: string) {
		if (editForm.title.trim() && editForm.content.trim()) {
			memoryStore.updateMemory(id, {
				title: editForm.title.trim(),
				content: editForm.content.trim(),
				type: editForm.type,
				importance: editForm.importance
			});
			editingId = null;
		} else {
			alert('Title and content cannot be empty.');
		}
	}

	function handleDelete(id: string) {
		const memory = memoryStore.list.find((item) => item.id === id);
		if (!memory) return;
		if (
			confirm(
				'Are you sure you want to delete this memory? MOONDAY will forget this context in future conversations.'
			)
		) {
			memoryStore.deleteMemory(id);
			recentlyDeleted = memory;
			if (undoTimer) clearTimeout(undoTimer);
			undoTimer = setTimeout(() => {
				recentlyDeleted = null;
				undoTimer = null;
			}, 6000);
		}
	}

	function undoDelete() {
		if (!recentlyDeleted) return;
		memoryStore.addMemory({
			type: recentlyDeleted.type,
			title: recentlyDeleted.title,
			content: recentlyDeleted.content,
			importance: recentlyDeleted.importance,
			confidence: recentlyDeleted.confidence
		});
		recentlyDeleted = null;
		if (undoTimer) clearTimeout(undoTimer);
		undoTimer = null;
	}

	async function clearAllMemories() {
		if (
			!confirm(
				'Forget every saved memory? This cannot be undone and will not delete your conversations.'
			)
		)
			return;
		const cleared = await memoryStore.clearAllMemories();
		if (!cleared) alert('Unable to clear saved memories. Please try again.');
	}
</script>

<div class="space-y-8 select-none">
	<!-- Page Header -->
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="space-y-2">
			<h1 class="text-2xl font-extrabold text-soft-white tracking-tight">Saved Memories</h1>
			<p class="text-xs text-slate-gray">
				View, edit, and delete details MOONDAY has remembered about you from reflections.
			</p>
		</div>
		{#if memoryStore.list.length > 0}
			<button
				type="button"
				onclick={clearAllMemories}
				class="rounded-xl border border-soft-red/25 px-3 py-2 text-xs font-semibold text-soft-red hover:bg-soft-red/10"
			>
				Clear all memories
			</button>
		{/if}
	</div>

	<!-- Filter and Search Toolbar -->
	<div
		class="bg-soft-dark-blue border border-slate-gray/10 rounded-3xl p-5 md:p-6 shadow-xl space-y-4"
	>
		<div class="flex flex-col md:flex-row gap-4 items-center justify-between">
			<!-- Search Bar -->
			<div class="w-full md:flex-1 relative">
				<span
					class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-gray"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2.5"
						stroke="currentColor"
						class="w-4 h-4"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.636z"
						/>
					</svg>
				</span>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search memories by keyword..."
					class="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-deep-navy border border-slate-gray/10 text-soft-white placeholder-slate-gray outline-none focus:border-violet-glow/30 transition-all duration-300"
				/>
			</div>

			<!-- Filter Type Dropdown -->
			<div class="w-full md:w-60">
				<select
					bind:value={selectedType}
					class="w-full p-2.5 text-sm rounded-xl bg-deep-navy border border-slate-gray/10 text-soft-white outline-none focus:border-violet-glow/30 transition-all duration-300 capitalize"
				>
					{#each memoryTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	{#if recentlyDeleted}
		<div
			role="status"
			class="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-4 py-3 rounded-2xl bg-soft-dark-blue border border-violet-glow/30 shadow-2xl text-xs text-pale-silver"
		>
			<span>Memory forgotten.</span>
			<button
				type="button"
				onclick={undoDelete}
				class="font-bold text-violet-glow hover:text-soft-white cursor-pointer"
			>
				Undo
			</button>
		</div>
	{/if}

	<!-- Memories Grid List -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
		{#each filteredMemories as memory}
			<div
				class="bg-soft-dark-blue border border-slate-gray/10 rounded-3xl p-5 md:p-6 space-y-3 relative hover:border-slate-gray/25 transition-colors duration-300"
			>
				{#if editingId === memory.id}
					<!-- Editing state Card Form -->
					<div class="space-y-4">
						<div class="space-y-1">
							<label
								for="memory-title"
								class="block text-[10px] uppercase font-bold text-slate-gray">Title</label
							>
							<input
								id="memory-title"
								type="text"
								bind:value={editForm.title}
								class="w-full p-2 text-xs rounded-lg bg-deep-navy border border-slate-gray/10 text-soft-white outline-none focus:border-violet-glow/30"
							/>
						</div>
						<div class="space-y-1">
							<label
								for="memory-content"
								class="block text-[10px] uppercase font-bold text-slate-gray">Content</label
							>
							<textarea
								id="memory-content"
								bind:value={editForm.content}
								rows="3"
								class="w-full p-2 text-xs rounded-lg bg-deep-navy border border-slate-gray/10 text-soft-white outline-none focus:border-violet-glow/30 resize-none"
							></textarea>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-1">
								<label
									for="memory-category"
									class="block text-[10px] uppercase font-bold text-slate-gray">Category</label
								>
								<select
									id="memory-category"
									bind:value={editForm.type}
									class="w-full p-2 text-xs rounded-lg bg-deep-navy border border-slate-gray/10 text-soft-white outline-none focus:border-violet-glow/30 capitalize"
								>
									{#each memoryTypes.slice(1) as type}
										<option value={type.value}>{type.label}</option>
									{/each}
								</select>
							</div>
							<div class="space-y-1">
								<label
									for="memory-importance"
									class="block text-[10px] uppercase font-bold text-slate-gray"
									>Importance ({editForm.importance})</label
								>
								<input
									id="memory-importance"
									type="range"
									min="1"
									max="10"
									bind:value={editForm.importance}
									class="w-full accent-violet-glow bg-deep-navy h-1.5 rounded-lg cursor-pointer"
								/>
							</div>
						</div>
						<!-- Action buttons -->
						<div class="flex gap-2 pt-2 justify-end select-none">
							<button
								onclick={cancelEdit}
								class="py-1.5 px-3 rounded-lg border border-slate-gray/10 hover:bg-slate-gray/10 text-xs font-semibold text-pale-silver cursor-pointer"
							>
								Cancel
							</button>
							<button
								onclick={() => saveEdit(memory.id)}
								class="py-1.5 px-4 rounded-lg bg-violet-glow text-deep-navy hover:bg-violet-glow/90 text-xs font-bold cursor-pointer"
							>
								Save changes
							</button>
						</div>
					</div>
				{:else}
					<!-- View state Card -->
					<div class="flex justify-between items-start gap-2">
						<span
							class="text-[9px] bg-violet-glow/10 text-violet-glow border border-violet-glow/15 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
						>
							{memory.type.replace('_', ' ')}
						</span>

						<!-- Action Controls -->
						<div class="flex items-center gap-1.5">
							<button
								onclick={() => startEdit(memory)}
								class="p-1.5 rounded-lg hover:bg-deep-navy/40 text-slate-gray hover:text-cyan-glow transition-colors duration-300 cursor-pointer"
								title="Edit memory context"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="2"
									stroke="currentColor"
									class="w-4 h-4"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
									/>
								</svg>
							</button>
							<button
								onclick={() => handleDelete(memory.id)}
								class="p-1.5 rounded-lg hover:bg-deep-navy/40 text-slate-gray hover:text-soft-red transition-colors duration-300 cursor-pointer"
								title="Forget this memory"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="2"
									stroke="currentColor"
									class="w-4 h-4"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
									/>
								</svg>
							</button>
						</div>
					</div>

					<h2 class="text-sm font-bold text-soft-white pr-10">{memory.title}</h2>
					<p class="text-xs text-pale-silver leading-relaxed line-clamp-4">{memory.content}</p>

					<!-- Confidence signals -->
					<div
						class="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-gray/10 text-[10px] font-mono"
					>
						<span class="px-2 py-1 rounded-md bg-violet-glow/10 text-violet-glow"
							>Importance {memory.importance}/10</span
						>
						<span class="px-2 py-1 rounded-md bg-cyan-glow/10 text-cyan-glow"
							>{Math.round(memory.confidence * 100)}% confidence</span
						>
						<span class="ml-auto text-slate-gray"
							>Saved {new Date(memory.createdAt).toLocaleDateString()}</span
						>
					</div>
				{/if}
			</div>
		{:else}
			<div
				class="col-span-1 md:col-span-2 bg-soft-dark-blue/40 border border-dashed border-slate-gray/10 rounded-3xl p-10 text-center text-slate-gray select-none py-16"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-12 h-12 mx-auto mb-3 opacity-30"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
					/>
				</svg>
				<p class="text-sm font-semibold">No memories matched your query.</p>
				<p class="text-xs max-w-sm mx-auto mt-1">
					If there are no memories yet, try talking to MOONDAY. Useful context will extract
					automatically.
				</p>
			</div>
		{/each}
	</div>
</div>
