<script lang="ts">
	import type { ChatMessage } from '$lib/stores/chat.svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { memoryStore } from '$lib/stores/memory.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { MOODS } from '$lib/stores/mood.svelte';
	import { fade } from 'svelte/transition';
	import { marked } from 'marked';
	import { RESPONSE_FEEDBACK_LABELS, type ResponseFeedbackType } from '$lib/types/feedback';
	import AvatarMoon from './AvatarMoon.svelte';
	import MoodIcon from './MoodIcon.svelte';
	import {
		Bookmark,
		ChevronDown,
		GitBranch,
		MoreHorizontal,
		Pencil,
		RefreshCw,
		SlidersHorizontal,
		ThumbsDown,
		ThumbsUp,
		Volume2,
		VolumeX
	} from 'lucide-svelte';

	let {
		message,
		characterName = 'MOONDAY',
		isLastAssistant = false
	} = $props<{
		message: ChatMessage;
		characterName?: string;
		isLastAssistant?: boolean;
	}>();

	let isEditing = $state(false);
	let editedContent = $state('');
	let feedbackOpen = $state(false);
	let feedbackSaved = $state<string | null>(null);
	let adjustMenuOpen = $state(false);
	let moreMenuOpen = $state(false);

	const responseAdjustments = [
		['Shorter', 'Please make your previous response shorter and clearer.'],
		[
			'Warmer',
			'Please make your previous response warmer and more reassuring, without becoming dramatic.'
		],
		[
			'Funnier',
			'Please make your previous response a little funnier and lightly witty, never mean.'
		],
		['More direct', 'Please make your previous response more direct and concise.'],
		['More practical', 'Please turn your previous response into practical next steps.'],
		['Go deeper', 'Please go deeper on your previous response.']
	] as const;

	async function submitFeedback(type: ResponseFeedbackType) {
		if (!message.persisted) return;
		const saved = await chatStore.recordResponseFeedback(message.id, type);
		if (saved) {
			feedbackSaved = RESPONSE_FEEDBACK_LABELS[type];
			feedbackOpen = false;
		}
	}

	function startEditing() {
		isEditing = true;
		editedContent = message.content;
	}

	function cancelEditing() {
		isEditing = false;
	}

	function saveEdit() {
		isEditing = false;
		chatStore.editMessage(message.id, editedContent);
	}

	function saveReflection() {
		void memoryStore.saveSuggestion({
			type: 'reflection',
			title: `MOONDAY reflection — ${new Date(message.createdAt).toLocaleDateString()}`,
			content: message.content,
			importance: 6,
			confidence: 0.8,
			sourceConversationId: chatStore.activeId || undefined,
			sourceMessageId: message.persisted ? message.id : undefined
		});
	}

	// Configure marked options
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	// Format time helper
	const formattedTime = $derived.by(() => {
		try {
			return new Date(message.createdAt).toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return '';
		}
	});

	// Find the semantic mood icon and colors if an assistant message has an emotion label.
	const emotionDetails = $derived.by(() => {
		if (message.role !== 'assistant' || !message.emotionLabel) return null;
		return MOODS.find((m) => m.label === message.emotionLabel) || null;
	});

	// Parse Markdown content for assistant replies
	const parsedContent = $derived.by(() => {
		if (message.role === 'assistant') {
			try {
				return marked.parse(message.content) as string;
			} catch {
				return message.content;
			}
		}
		return message.content;
	});
</script>

{#if message.role === 'system'}
	<div transition:fade={{ duration: 150 }} class="my-3 flex justify-center">
		<span class="rounded-full bg-soft-dark-blue/55 px-3 py-1.5 text-xs text-slate-gray">
			{message.content}
		</span>
	</div>
{:else}
	<div
		transition:fade={{ duration: 200 }}
		class="my-5 flex w-full {message.role === 'user' ? 'justify-end' : 'justify-start'}"
	>
		<div
			class="flex w-full items-start gap-3 {message.role === 'user'
				? 'max-w-[85%] flex-row-reverse md:max-w-[72%]'
				: 'max-w-[92%] md:max-w-[78%] xl:max-w-[72%]'}"
		>
			{#if message.role === 'assistant'}
				<div class="mt-5 h-8 w-8 shrink-0">
					<AvatarMoon />
				</div>
			{/if}

			<div class="flex min-w-0 flex-1 flex-col gap-1.5">
				<div
					class="flex items-center gap-2 px-1 text-xs text-slate-gray {message.role === 'user'
						? 'justify-end'
						: 'justify-start'}"
				>
					<span class="font-medium text-pale-silver">
						{message.role === 'user' ? 'You' : characterName}
					</span>
					<span aria-hidden="true">·</span>
					<time>{formattedTime}</time>
				</div>

				{#if message.role === 'assistant' && message.status}
					<div
						class="flex items-center gap-2 px-1 text-xs font-medium text-cyan-glow"
						aria-live="polite"
					>
						<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-glow"></span>
						<span>{message.status.replace(/^[\p{Extended_Pictographic}\s]+/u, '')}</span>
					</div>
				{/if}

				<div
					class="rounded-3xl px-5 py-4 text-base leading-[1.65] transition-all duration-300 {message.role ===
					'user'
						? 'rounded-tr-lg border border-violet-glow/25 bg-[linear-gradient(135deg,#40366f,#17584f)] text-soft-white font-semibold shadow-[0_12px_34px_rgba(0,0,0,0.2)]'
						: 'rounded-tl-lg border border-cyan-glow/10 bg-[linear-gradient(145deg,rgba(10,39,36,0.98),rgba(5,26,24,0.98))] text-soft-white shadow-[0_14px_36px_rgba(0,0,0,0.22)]'} {isLastAssistant &&
					(chatStore.isThinking || chatStore.isStreaming)
						? 'opacity-80'
						: ''}"
				>
					{#if message.role === 'assistant'}
						<div class="markdown-content">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html parsedContent}
						</div>
					{:else if isEditing}
						<div class="flex min-w-[200px] flex-col gap-3 md:min-w-[300px]">
							<textarea
								bind:value={editedContent}
								class="w-full resize-y rounded-xl border border-cyan-glow/15 bg-deep-navy/70 p-2 text-base text-soft-white outline-none"
								rows="3"
								aria-label="Edit message"></textarea>
							<div class="flex justify-end gap-2 text-xs">
								<button onclick={cancelEditing} class="rounded-lg px-3 py-1.5 text-deep-navy">
									Cancel
								</button>
								<button
									onclick={saveEdit}
									disabled={!editedContent.trim()}
									class="rounded-lg bg-deep-navy px-3 py-1.5 font-medium text-violet-glow disabled:opacity-50"
								>
									Save
								</button>
							</div>
						</div>
					{:else}
						<p class="whitespace-pre-wrap">{message.content}</p>
					{/if}
				</div>

				{#if emotionDetails}
					<span
						class="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-current/30 px-2.5 py-1 text-xs font-medium capitalize {emotionDetails.color}"
						title="Possible reflected mood"
					>
						<MoodIcon name={emotionDetails.icon} size={14} />
						{emotionDetails.label}
					</span>
				{/if}

				{#if message.role === 'assistant' && isLastAssistant && message.content}
					<div class="mt-1 flex flex-wrap items-center gap-1.5 px-1">
						<button
							type="button"
							onclick={() => chatStore.rerollLastMessage()}
							disabled={chatStore.isStreaming || chatStore.isThinking || chatStore.isRerolling}
							class="message-action"
							title="Generate another response"
						>
							<RefreshCw
								size={15}
								class={chatStore.isRerolling ? 'animate-spin' : ''}
								aria-hidden="true"
							/>
							<span>{chatStore.isRerolling ? 'Regenerating…' : 'Regenerate'}</span>
						</button>
						<button type="button" onclick={saveReflection} class="message-action">
							<Bookmark size={15} aria-hidden="true" />
							<span>Save</span>
						</button>
						{#if feedbackSaved}
							<span class="px-2 text-xs text-cyan-glow">Thanks — {feedbackSaved}.</span>
						{:else if message.persisted}
							<button
								type="button"
								onclick={() => submitFeedback('helpful')}
								class="message-action"
							>
								<ThumbsUp size={15} aria-hidden="true" />
								<span>Helpful</span>
							</button>
						{/if}

						<div class="relative">
							<button
								type="button"
								onclick={() => {
									adjustMenuOpen = !adjustMenuOpen;
									moreMenuOpen = false;
								}}
								class="message-action"
								aria-expanded={adjustMenuOpen}
							>
								<SlidersHorizontal size={15} aria-hidden="true" />
								<span>Adjust response</span>
								<ChevronDown size={13} aria-hidden="true" />
							</button>
							{#if adjustMenuOpen}
								<div class="message-menu left-0" role="menu" aria-label="Adjust response">
									{#each responseAdjustments as action (action[0])}
										<button
											type="button"
											role="menuitem"
											onclick={() => {
												adjustMenuOpen = false;
												chatStore.sendMessage(action[1]);
											}}
											disabled={chatStore.isThinking || chatStore.isStreaming}
										>
											{action[0]}
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<div class="relative">
							<button
								type="button"
								onclick={() => {
									moreMenuOpen = !moreMenuOpen;
									adjustMenuOpen = false;
								}}
								class="icon-button h-8 w-8 text-slate-gray"
								title="More response actions"
								aria-label="More response actions"
								aria-expanded={moreMenuOpen}
							>
								<MoreHorizontal size={17} aria-hidden="true" />
							</button>
							{#if moreMenuOpen}
								<div class="message-menu right-0" role="menu" aria-label="More response actions">
									<button
										type="button"
										role="menuitem"
										onclick={() =>
											voiceStore.isSpeaking || voiceStore.isPreparingSpeech
												? voiceStore.stopSpeaking()
												: voiceStore.speak(message.content)}
									>
										{#if voiceStore.isSpeaking || voiceStore.isPreparingSpeech}
											<VolumeX size={15} aria-hidden="true" />
											Stop speaking
										{:else}
											<Volume2 size={15} aria-hidden="true" />
											Speak response
										{/if}
									</button>
									<button
										type="button"
										role="menuitem"
										onclick={() => chatStore.branchConversation(message.id)}
									>
										<GitBranch size={15} aria-hidden="true" />
										Branch here
									</button>
									{#if message.persisted}
										<button
											type="button"
											role="menuitem"
											onclick={() => {
												feedbackOpen = !feedbackOpen;
												moreMenuOpen = false;
											}}
										>
											<ThumbsDown size={15} aria-hidden="true" />
											Needs work
										</button>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					{#if feedbackOpen && message.persisted}
						<div class="mt-2 flex flex-wrap gap-2 px-1" aria-label="Response feedback">
							{#each ['not_helpful', 'too_long', 'too_generic', 'too_much_humor', 'wrong_language'] as ResponseFeedbackType[] as type (type)}
								<button
									type="button"
									onclick={() => submitFeedback(type)}
									class="message-action text-soft-red"
								>
									{RESPONSE_FEEDBACK_LABELS[type]}
								</button>
							{/each}
						</div>
					{/if}
				{/if}

				{#if message.role === 'user' && message.persisted && !isEditing && !chatStore.isStreaming && !chatStore.isThinking}
					<div class="flex justify-end px-1">
						<button
							type="button"
							onclick={startEditing}
							class="icon-button h-8 w-8 text-slate-gray"
							title="Edit message"
							aria-label="Edit message"
						>
							<Pencil size={15} aria-hidden="true" />
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.message-action) {
		display: inline-flex;
		min-height: 2rem;
		align-items: center;
		gap: 0.375rem;
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.625rem;
		padding: 0.35rem 0.625rem;
		color: var(--color-pale-silver);
		font-size: 0.75rem;
		font-weight: 600;
		transition:
			border-color 160ms ease,
			background-color 160ms ease,
			color 160ms ease;
	}

	:global(.message-action:hover) {
		border-color: rgb(103 230 210 / 0.35);
		background: rgb(103 230 210 / 0.08);
		color: var(--color-soft-white);
	}

	:global(.message-action:disabled) {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.message-menu {
		position: absolute;
		z-index: 40;
		bottom: calc(100% + 0.5rem);
		display: grid;
		min-width: 11rem;
		gap: 0.125rem;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 0.875rem;
		background: #102a28;
		padding: 0.375rem;
		box-shadow: 0 16px 40px rgb(0 0 0 / 0.35);
	}

	.message-menu button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 0.625rem;
		padding: 0.55rem 0.625rem;
		color: var(--color-pale-silver);
		font-size: 0.75rem;
		text-align: left;
	}

	.message-menu button:hover {
		background: rgb(255 255 255 / 0.06);
		color: var(--color-soft-white);
	}

	:global(.markdown-content p) {
		margin-bottom: 0.75rem;
	}
	:global(.markdown-content p:last-child) {
		margin-bottom: 0;
	}
	:global(.markdown-content ul) {
		list-style-type: disc;
		padding-left: 1.25rem;
		margin-bottom: 0.5rem;
	}
	:global(.markdown-content ol) {
		list-style-type: decimal;
		padding-left: 1.25rem;
		margin-bottom: 0.5rem;
	}
	:global(.markdown-content li) {
		margin-bottom: 0.3rem;
	}
	:global(.markdown-content code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		background-color: rgba(255, 255, 255, 0.15);
		color: var(--color-cyan-glow);
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
	}
	:global(.markdown-content pre) {
		background-color: rgba(0, 0, 0, 0.25);
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		overflow-x: auto;
		margin-top: 0.375rem;
		margin-bottom: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}
	:global(.markdown-content pre code) {
		background-color: transparent;
		padding: 0;
		color: inherit;
		font-size: 0.825rem;
	}
	:global(.markdown-content strong) {
		font-weight: 600;
		color: var(--color-soft-white);
	}
	:global(.markdown-content em) {
		font-style: italic;
	}
</style>
