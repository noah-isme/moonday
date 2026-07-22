<script lang="ts">
	import VoiceButton from './VoiceButton.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { chatStore } from '$lib/stores/chat.svelte';

	let {
		onSend,
		isThinking = false,
		doNotRemember = false,
		onToggleDoNotRemember
	} = $props<{
		onSend: (text: string) => void;
		isThinking?: boolean;
		doNotRemember?: boolean;
		onToggleDoNotRemember?: () => void;
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

	function discardTranscript() {
		voiceStore.stopListening();
		voiceStore.transcript = '';
		textValue = '';
	}
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
		placeholder={voiceStore.isListening ? 'Listening — tap the microphone when you are done...' : 'Type your thoughts...'}
		disabled={isThinking}
		rows="1"
		class="flex-1 max-h-32 min-h-[40px] py-2.5 px-3 bg-transparent text-soft-white text-sm outline-none resize-none placeholder-slate-gray disabled:opacity-50 overflow-y-auto"
	></textarea>

	<!-- Web Search Toggle Button -->
	<button
		type="button"
		onclick={onToggleDoNotRemember}
		class="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 relative group cursor-pointer border {doNotRemember
			? 'bg-cyan-glow/15 border-cyan-glow/50 text-cyan-glow'
			: 'bg-transparent border-slate-gray/20 text-slate-gray hover:text-pale-silver hover:border-slate-gray/40'}"
		title={doNotRemember
			? 'This message will not be considered for memory'
			: 'Do not remember this message'}
		aria-label={doNotRemember
			? 'Allow memory suggestions for this message'
			: 'Do not remember this message'}
		aria-pressed={doNotRemember}
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
				d="M12 15.75a3.75 3.75 0 0 0 3.75-3.75V9a3.75 3.75 0 1 0-7.5 0v3A3.75 3.75 0 0 0 12 15.75Zm0 0v3m-3 0h6"
			/>
		</svg>
	</button>

	<!-- Web Search Toggle Button -->
	<button
		type="button"
		onclick={() => chatStore.toggleWebSearch()}
		class="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 relative group cursor-pointer border {chatStore.isWebSearchEnabled
			? 'bg-violet-glow/20 border-violet-glow text-violet-glow shadow-[0_0_10px_rgba(139,92,246,0.5)] animate-pulse'
			: 'bg-transparent border-slate-gray/20 text-slate-gray hover:text-pale-silver hover:border-slate-gray/40'}"
		title="Deep Research Mode (Web Access)"
		aria-label="Deep Research Mode (Web Access)"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
			class="w-5 h-5"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-.778.099-1.533.284-2.253"
			/>
		</svg>
		<span
			class="absolute bottom-full mb-2 hidden group-hover:block bg-deep-navy border border-slate-gray/30 text-soft-white text-xs py-1 px-2 rounded whitespace-nowrap z-50 pointer-events-none transition-all duration-300"
		>
			Deep Research Mode (Web Access): {chatStore.isWebSearchEnabled ? 'ON' : 'OFF'}
		</span>
	</button>

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

{#if voiceStore.isListening || voiceStore.isTranscribing || voiceStore.transcript.trim()}
	<div class="mt-2 flex items-center justify-between gap-3 px-2 text-xs" aria-live="polite">
		<p class={voiceStore.isListening ? 'text-cyan-glow' : 'text-slate-gray'}>
			{voiceStore.isTranscribing
				? 'Transcribing your recording…'
				: voiceStore.isListening
				? voiceStore.recognitionState === 'starting'
					? 'Starting microphone…'
					: 'Listening… your words stay editable before sending.'
				: 'Transcript ready to review.'}
		</p>
		{#if voiceStore.transcript.trim() && !voiceStore.isListening}
			<button
				type="button"
				onclick={discardTranscript}
				class="rounded-md px-2 py-1 text-slate-gray hover:text-pale-silver"
			>
				Discard
			</button>
		{/if}
	</div>
{/if}

{#if voiceStore.isPreparingSpeech}
	<div class="mt-2 px-2 text-xs text-cyan-glow" aria-live="polite">
		MOONDAY is preparing your local voice…
	</div>
{/if}

{#if voiceStore.errorMessage}
	<div class="mt-2 flex items-center justify-between gap-3 px-2 text-xs text-soft-red" role="alert">
		<span>{voiceStore.errorMessage}</span>
		<button type="button" onclick={() => (voiceStore.errorMessage = null)} class="shrink-0 rounded px-1 text-slate-gray hover:text-pale-silver" aria-label="Dismiss voice error">×</button>
	</div>
{/if}
