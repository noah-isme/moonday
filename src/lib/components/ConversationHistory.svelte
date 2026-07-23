<script lang="ts">
	import { chatStore, type Conversation } from '$lib/stores/chat.svelte';
	import { Edit3, MessageCircle, Plus, Trash2, X } from 'lucide-svelte';
	import { conversationPreview, formatConversationDate } from '$lib/conversationPresentation';

	let {
		onSelect,
		onClose,
		showClose = false
	} = $props<{
		onSelect?: (id: string) => void;
		onClose?: () => void;
		showClose?: boolean;
	}>();

	let renameId = $state<string | null>(null);
	let renameValue = $state('');

	function handleSelect(id: string) {
		chatStore.selectConversation(id);
		onSelect?.(id);
	}

	function startRename(conversation: Conversation) {
		renameId = conversation.id;
		renameValue = conversation.title;
	}

	async function saveRename() {
		if (renameId && renameValue.trim()) {
			const renamed = await chatStore.updateConversationTitle(renameId, renameValue.trim());
			if (renamed) renameId = null;
		}
	}

	async function handleRenameKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') await saveRename();
		if (event.key === 'Escape') renameId = null;
	}

	async function createConversation() {
		const conversation = await chatStore.createNewConversation();
		if (conversation) onSelect?.(conversation.id);
	}
</script>

<div class="flex h-full min-h-0 flex-col bg-soft-dark-blue/45 p-4">
	<div class="mb-4 flex items-center justify-between gap-3">
		<div>
			<p class="text-sm font-semibold text-soft-white">Recent conversations</p>
			<p class="mt-0.5 text-xs text-slate-gray">Your latest moments with MOONDAY</p>
		</div>
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={createConversation}
				class="icon-button text-violet-glow"
				title="Start a new conversation"
				aria-label="Start a new conversation"
			>
				<Plus size={18} aria-hidden="true" />
			</button>
			{#if showClose}
				<button
					type="button"
					onclick={onClose}
					class="icon-button text-slate-gray"
					title="Close conversation history"
					aria-label="Close conversation history"
				>
					<X size={18} aria-hidden="true" />
				</button>
			{/if}
		</div>
	</div>

	<div class="flex-1 space-y-2 overflow-y-auto pr-1">
		{#each chatStore.conversations as conversation (conversation.id)}
			{@const isActive = chatStore.activeId === conversation.id}
			<article
				class="group relative rounded-2xl border p-3 transition-colors {isActive
					? 'border-violet-glow/45 bg-violet-glow/12 shadow-[inset_3px_0_0_#a78bfa]'
					: 'border-transparent bg-deep-navy/20 hover:border-white/8 hover:bg-deep-navy/40'}"
				aria-current={isActive ? 'page' : undefined}
			>
				{#if renameId === conversation.id}
					<input
						type="text"
						bind:value={renameValue}
						onblur={saveRename}
						onkeydown={handleRenameKeyDown}
						aria-label="Conversation title"
						class="w-full rounded-lg border border-violet-glow/40 bg-deep-navy px-2 py-1.5 text-sm text-soft-white outline-none"
					/>
				{:else}
					<button
						type="button"
						onclick={() => handleSelect(conversation.id)}
						class="block w-full pr-12 text-left"
						aria-label={`Open ${conversation.title}`}
					>
						<span class="line-clamp-2 text-sm font-semibold leading-5 text-pale-silver">
							{conversation.title}
						</span>
						<span class="mt-1 line-clamp-1 text-xs leading-5 text-slate-gray">
							{conversationPreview(conversation, chatStore.messages[conversation.id])}
						</span>
						<span class="mt-1.5 block text-xs font-medium text-slate-gray">
							{formatConversationDate(conversation.updatedAt)}
						</span>
					</button>

					<div
						class="absolute right-2 top-2 flex gap-0.5 rounded-lg bg-soft-dark-blue/90 p-0.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
					>
						<button
							type="button"
							onclick={() => startRename(conversation)}
							class="icon-button h-7 w-7 text-slate-gray hover:text-cyan-glow"
							title="Rename conversation"
							aria-label={`Rename ${conversation.title}`}
						>
							<Edit3 size={14} aria-hidden="true" />
						</button>
						{#if chatStore.conversations.length > 1}
							<button
								type="button"
								onclick={() => chatStore.deleteConversation(conversation.id)}
								class="icon-button h-7 w-7 text-slate-gray hover:text-soft-red"
								title="Delete conversation"
								aria-label={`Delete ${conversation.title}`}
							>
								<Trash2 size={14} aria-hidden="true" />
							</button>
						{/if}
					</div>
				{/if}
			</article>
		{:else}
			<div class="flex flex-col items-center py-10 text-center text-slate-gray">
				<MessageCircle size={24} class="mb-2" aria-hidden="true" />
				<p class="text-sm">No conversations yet.</p>
			</div>
		{/each}
	</div>
</div>

<style>
	:global(.icon-button) {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
		transition:
			color 160ms ease,
			background-color 160ms ease;
	}

	:global(.icon-button:hover) {
		background: rgb(255 255 255 / 0.06);
	}
</style>
