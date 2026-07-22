<script lang="ts">
	import type { ChatMessage } from '$lib/stores/chat.svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { memoryStore } from '$lib/stores/memory.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { MOODS } from '$lib/stores/mood.svelte';
	import { fade } from 'svelte/transition';
	import { marked } from 'marked';
	import { RESPONSE_FEEDBACK_LABELS, type ResponseFeedbackType } from '$lib/types/feedback';

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
		} catch (e) {
			return '';
		}
	});

	// Find mood emoji and colors if assistant message has an emotion label
	const emotionDetails = $derived.by(() => {
		if (message.role !== 'assistant' || !message.emotionLabel) return null;
		return MOODS.find((m) => m.label === message.emotionLabel) || null;
	});

	// Parse Markdown content for assistant replies
	const parsedContent = $derived.by(() => {
		if (message.role === 'assistant') {
			try {
				return marked.parse(message.content) as string;
			} catch (e) {
				console.error('Failed to parse markdown:', e);
				return message.content;
			}
		}
		return message.content;
	});
</script>

{#if message.role === 'system'}
	<!-- System notification message -->
	<div transition:fade={{ duration: 150 }} class="flex justify-center my-3">
		<span
			class="px-3 py-1 text-xs text-slate-gray bg-soft-dark-blue/50 rounded-full border border-slate-gray/10 select-none"
		>
			{message.content}
		</span>
	</div>
{:else}
	<!-- User or Assistant chat bubbles -->
	<div
		transition:fade={{ duration: 200 }}
		class="flex w-full my-4 flex-col {message.role === 'user' ? 'items-end' : 'items-start'}"
	>
		<!-- Bubble wrapper -->
		<div class="max-w-[80%] md:max-w-[70%] flex flex-col gap-1">
			<!-- Sender Name & Metadata -->
			<div
				class="flex items-center gap-2 px-1 text-xs text-slate-gray select-none {message.role ===
				'user'
					? 'justify-end'
					: 'justify-start'}"
			>
				<span class="font-medium text-pale-silver"
					>{message.role === 'user' ? 'You' : characterName}</span
				>
				<span>•</span>
				<span>{formattedTime}</span>
			</div>

			<!-- Shimmering status -->
			{#if message.role === 'assistant' && message.status}
				<div
					class="px-1 py-0.5 text-xs flex items-center gap-1.5 select-none font-medium italic animate-pulse"
				>
					<span
						class="inline-block w-1.5 h-1.5 rounded-full bg-violet-glow shadow-[0_0_8px_#c084fc] animate-ping"
					></span>
					<span class="text-violet-glow/90">{message.status}</span>
				</div>
			{/if}

			<!-- Main Bubble Body -->
			<div
				class="px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-300 shadow-lg {message.role ===
				'user'
					? 'bg-violet-glow text-deep-navy font-medium rounded-tr-none'
					: 'bg-soft-dark-blue text-soft-white border border-slate-gray/10 rounded-tl-none'} {isLastAssistant &&
				(chatStore.isThinking || chatStore.isStreaming)
					? 'animate-pulse opacity-80'
					: ''}"
			>
				{#if message.role === 'assistant'}
					<div class="markdown-content">
						{@html parsedContent}
					</div>
				{:else}
					{#if isEditing}
						<div class="flex flex-col gap-2 w-full min-w-[200px] md:min-w-[300px]">
							<textarea
								bind:value={editedContent}
								class="w-full p-2 text-sm text-deep-navy bg-white/40 rounded-md border border-deep-navy/20 focus:outline-none focus:border-deep-navy/50 resize-y"
								rows="3"></textarea>
							<div class="flex justify-end gap-2 text-xs">
								<button
									onclick={cancelEditing}
									class="px-2 py-1 rounded bg-deep-navy/10 text-deep-navy hover:bg-deep-navy/20 transition-colors font-medium"
								>
									Cancel
								</button>
								<button
									onclick={saveEdit}
									disabled={!editedContent.trim()}
									class="px-2 py-1 rounded bg-deep-navy text-violet-glow hover:bg-deep-navy/90 transition-colors font-medium disabled:opacity-50"
								>
									Save
								</button>
							</div>
						</div>
					{:else}
						<p class="whitespace-pre-wrap">{message.content}</p>
					{/if}
				{/if}
			</div>

			<!-- Emotion / Mood Feedback Badge and Reroll Button for Assistant Replies -->
			{#if emotionDetails || (message.role === 'assistant' && isLastAssistant)}
				<div class="flex px-1 mt-1 justify-start items-center gap-2">
					{#if emotionDetails}
						<span
							class="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full border border-current font-medium transition-all duration-300 {emotionDetails.color} opacity-80"
							title="Mood classification score: {message.moodScore}"
						>
							<span>{emotionDetails.emoji}</span>
							<span class="capitalize">{emotionDetails.label}</span>
						</span>
					{/if}

					{#if message.role === 'assistant' && isLastAssistant}
						<button
							onclick={() => chatStore.rerollLastMessage()}
							disabled={chatStore.isStreaming || chatStore.isThinking || chatStore.isRerolling}
							class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-gray/15 text-xs font-medium text-pale-silver hover:border-violet-glow/50 hover:bg-violet-glow/10 transition-colors focus:outline-none focus:ring-1 focus:ring-purple-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
							title="Generate another response"
							aria-label="Regenerate response"
						>
							<svg
								class="w-3.5 h-3.5 {chatStore.isThinking ||
								chatStore.isStreaming ||
								chatStore.isRerolling
									? 'animate-spin'
									: ''}"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
								/>
							</svg>
							<span>{chatStore.isRerolling ? 'Regenerating…' : 'Regenerate'}</span>
						</button>
					{/if}
				</div>
			{/if}

			{#if message.role === 'assistant' && isLastAssistant && message.content}
				<div class="flex flex-wrap gap-1.5 px-1 mt-1">
					{#each [['Shorter', 'Please make your previous response shorter and clearer.'], ['Warmer', 'Please make your previous response warmer and more reassuring, without becoming dramatic.'], ['Funnier', 'Please make your previous response a little funnier and lightly witty, never mean.'], ['More direct', 'Please make your previous response more direct and concise.'], ['More practical', 'Please turn your previous response into practical next steps.'], ['Go deeper', 'Please go deeper on your previous response.']] as action}
						<button
							type="button"
							onclick={() => chatStore.sendMessage(action[1])}
							disabled={chatStore.isThinking || chatStore.isStreaming}
							class="rounded-md border border-slate-gray/15 px-2 py-1 text-[10px] text-slate-gray hover:border-violet-glow/40 hover:text-pale-silver disabled:opacity-50"
							>{action[0]}</button
						>
					{/each}
					<button
						type="button"
							onclick={() =>
								voiceStore.isSpeaking || voiceStore.isPreparingSpeech
									? voiceStore.stopSpeaking()
									: voiceStore.speak(message.content)}
						class="rounded-md border border-slate-gray/15 px-2 py-1 text-[10px] text-slate-gray hover:border-violet-glow/40 hover:text-pale-silver"
						>{voiceStore.isSpeaking || voiceStore.isPreparingSpeech ? 'Stop speaking' : 'Speak'}</button
					>
					<button
						type="button"
						onclick={saveReflection}
						class="rounded-md border border-slate-gray/15 px-2 py-1 text-[10px] text-slate-gray hover:border-violet-glow/40 hover:text-pale-silver"
						>Save reflection</button
					>
					<button
						type="button"
						onclick={() => chatStore.branchConversation(message.id)}
						class="rounded-md border border-slate-gray/15 px-2 py-1 text-[10px] text-slate-gray hover:border-violet-glow/40 hover:text-pale-silver"
						>Branch here</button
					>
					{#if feedbackSaved}
						<span class="self-center text-[10px] text-cyan-glow">Thanks — {feedbackSaved}, kept private.</span>
					{:else if message.persisted}
						<button type="button" onclick={() => submitFeedback('helpful')} class="rounded-md border border-slate-gray/15 px-2 py-1 text-[10px] text-slate-gray hover:border-cyan-glow/40 hover:text-cyan-glow">Helpful</button>
						<button type="button" onclick={() => (feedbackOpen = !feedbackOpen)} class="rounded-md border border-slate-gray/15 px-2 py-1 text-[10px] text-slate-gray hover:border-violet-glow/40 hover:text-pale-silver">Needs work</button>
					{/if}
				</div>
				{#if feedbackOpen && message.persisted}
					<div class="mt-2 flex flex-wrap gap-1.5 px-1">
						{#each (['not_helpful', 'too_long', 'too_generic', 'too_much_humor', 'wrong_language'] as ResponseFeedbackType[]) as type}
							<button type="button" onclick={() => submitFeedback(type)} class="rounded-md border border-slate-gray/15 px-2 py-1 text-[10px] text-slate-gray hover:border-soft-red/40 hover:text-pale-silver">{RESPONSE_FEEDBACK_LABELS[type]}</button>
						{/each}
					</div>
				{/if}
			{/if}

			{#if message.role === 'user' && message.persisted === true && !isEditing && !chatStore.isStreaming && !chatStore.isThinking}
				<div class="flex px-1 mt-1 justify-end items-center gap-2">
					<button
						onclick={startEditing}
						class="inline-flex items-center justify-center p-1 rounded-full text-slate-gray hover:text-pale-silver hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-purple-accent/50 text-xs"
						title="Edit message"
						aria-label="Edit message"
					>
						✏️
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(.markdown-content p) {
		margin-bottom: 0.5rem;
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
		margin-bottom: 0.125rem;
	}
	:global(.markdown-content code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		background-color: rgba(255, 255, 255, 0.15);
		color: #c084fc; /* purple accent */
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
		color: #e2e8f0;
	}
	:global(.markdown-content em) {
		font-style: italic;
	}
</style>
