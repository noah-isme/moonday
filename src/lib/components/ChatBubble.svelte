<script lang="ts">
	import type { ChatMessage } from '$lib/stores/chat.svelte';
	import { MOODS } from '$lib/stores/mood.svelte';

	let { message, characterName = 'MOONDAY' } = $props<{
		message: ChatMessage;
		characterName?: string;
	}>();

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
</script>

{#if message.role === 'system'}
	<!-- System notification message -->
	<div class="flex justify-center my-3">
		<span
			class="px-3 py-1 text-xs text-slate-gray bg-soft-dark-blue/50 rounded-full border border-slate-gray/10 select-none"
		>
			{message.content}
		</span>
	</div>
{:else}
	<!-- User or Assistant chat bubbles -->
	<div class="flex w-full my-4 flex-col {message.role === 'user' ? 'items-end' : 'items-start'}">
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
				<p class="whitespace-pre-wrap">{message.content}</p>
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
