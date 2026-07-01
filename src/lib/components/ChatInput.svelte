<script lang="ts">
	import VoiceButton from './VoiceButton.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';

	let { onSend, isThinking = false } = $props<{
		onSend: (text: string) => void;
		isThinking?: boolean;
	}>();

	let textValue = $state('');

	// Handle sending messages
	function handleSend() {
		if (!textValue.trim() || isThinking) return;
		onSend(textValue);
		textValue = '';
	}

	// Submit on Enter key (without Shift)
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSend();
		}
	}

	// Update textValue with microphone transcripts in real-time
	function handleTranscript(transcript: string) {
		textValue = transcript;
	}

	// When voice starts/ends, we hook into voiceStore to auto-send on speech completion (optional/gentle)
	$effect(() => {
		voiceStore.onSpeechEnd = () => {
			if (textValue.trim() && !isThinking) {
				handleSend();
			}
		};
		return () => {
			voiceStore.onSpeechEnd = null;
		};
	});
</script>

<div
	class="w-full flex items-end gap-2 bg-soft-dark-blue p-2 rounded-2xl border border-slate-gray/10 focus-within:border-violet-glow/30 focus-within:ring-1 focus-within:ring-violet-glow/30 transition-all duration-300"
>
	<!-- Voice input button integration -->
	<VoiceButton onTranscript={handleTranscript} />

	<!-- Text Area for chat message -->
	<textarea
		bind:value={textValue}
		onkeydown={handleKeyDown}
		placeholder={voiceStore.isListening ? 'Listening to your voice...' : 'Type your thoughts...'}
		disabled={isThinking}
		rows="1"
		class="flex-1 max-h-32 min-h-[40px] py-2.5 px-3 bg-transparent text-soft-white text-sm outline-none resize-none placeholder-slate-gray disabled:opacity-50 overflow-y-auto"
	></textarea>

	<!-- Submit button -->
	<button
		type="button"
		onclick={handleSend}
		disabled={!textValue.trim() || isThinking}
		class="flex items-center justify-center w-10 h-10 rounded-full bg-violet-glow text-deep-navy hover:bg-violet-glow/90 disabled:bg-soft-dark-blue disabled:text-slate-gray disabled:border disabled:border-slate-gray/15 transition-all duration-300 cursor-pointer"
		title="Send message"
	>
		{#if isThinking}
			<!-- Spinner -->
			<svg class="animate-spin h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		{:else}
			<!-- Send Icon -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="2.5"
				stroke="currentColor"
				class="w-5 h-5 translate-x-[1px] -translate-y-[1px]"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
				/>
			</svg>
		{/if}
	</button>
</div>
