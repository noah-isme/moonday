<script lang="ts">
	import type { ChatMessage } from '$lib/stores/chat.svelte';
	import { MOODS } from '$lib/stores/mood.svelte';
	import { fade } from 'svelte/transition';
	import { marked } from 'marked';

	let { message, characterName = 'MOONDAY' } = $props<{
		message: ChatMessage;
		characterName?: string;
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
					: 'bg-soft-dark-blue text-soft-white border border-slate-gray/10 rounded-tl-none'}"
			>
				{#if message.role === 'assistant'}
					<div class="markdown-content">
						{@html parsedContent}
					</div>
				{:else}
					<p class="whitespace-pre-wrap">{message.content}</p>
				{/if}
			</div>

			<!-- Emotion / Mood Feedback Badge for Assistant Replies -->
			{#if emotionDetails}
				<div class="flex px-1 mt-1 justify-start">
					<span
						class="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full border border-current font-medium transition-all duration-300 {emotionDetails.color} opacity-80"
						title="Mood classification score: {message.moodScore}"
					>
						<span>{emotionDetails.emoji}</span>
						<span class="capitalize">{emotionDetails.label}</span>
					</span>
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
