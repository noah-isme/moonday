<script lang="ts">
	import type { ChatMessage } from '$lib/stores/chat.svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { MOODS } from '$lib/stores/mood.svelte';
	import { fade } from 'svelte/transition';
	import { marked } from 'marked';

	let { message, characterName = 'MOONDAY', isLastAssistant = false } = $props<{
		message: ChatMessage;
		characterName?: string;
		isLastAssistant?: boolean;
	}>();

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

			<!-- Main Bubble Body -->
			<div
				class="px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-300 shadow-lg {message.role ===
				'user'
					? 'bg-violet-glow text-deep-navy font-medium rounded-tr-none'
					: 'bg-soft-dark-blue text-soft-white border border-slate-gray/10 rounded-tl-none'} {isLastAssistant && (chatStore.isThinking || chatStore.isStreaming) ? 'animate-pulse opacity-80' : ''}"
			>
				{#if message.role === 'assistant'}
					<div class="markdown-content">
						{@html parsedContent}
					</div>
				{:else}
					<p class="whitespace-pre-wrap">{message.content}</p>
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
							disabled={chatStore.isThinking || chatStore.isStreaming}
							class="inline-flex items-center justify-center p-1 rounded-full text-slate-gray hover:text-pale-silver hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-purple-accent/50 disabled:opacity-50"
							title="Reroll last message"
							aria-label="Reroll last message"
						>
							<svg
								class="w-3.5 h-3.5 {chatStore.isThinking || chatStore.isStreaming ? 'animate-spin' : ''}"
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
						</button>
					{/if}
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
