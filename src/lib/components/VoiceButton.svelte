<script lang="ts">
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';

	let { onTranscript } = $props<{
		onTranscript?: (text: string) => void;
	}>();

	// Set up the voice store listener callback hooks when initialized
	$effect(() => {
		if (onTranscript) {
			voiceStore.onTranscriptChange = onTranscript;
		}
		return () => {
			voiceStore.onTranscriptChange = null;
		};
	});

	function handleVoiceClick(event: MouseEvent) {
		// Pointer interactions are handled as push-to-talk below. A click with detail 0 is keyboard activation.
		if (event.detail !== 0) return;
		if (!voiceStore.isSupported) {
			alert('Speech recognition is not supported in this browser. Try Chrome, Safari, or Edge.');
			return;
		}

		if (voiceStore.isListening) {
			voiceStore.stopListening();
		} else {
			voiceStore.startListening();
		}
	}

	function startPushToTalk(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		if (!voiceStore.isSupported || voiceStore.isListening) return;
		(event.currentTarget as HTMLButtonElement).setPointerCapture?.(event.pointerId);
		voiceStore.startListening();
	}

	function stopPushToTalk() {
		if (voiceStore.isListening) voiceStore.stopListening();
	}
</script>

{#if settingsStore.voiceInputEnabled}
	<button
		type="button"
		onclick={handleVoiceClick}
		onpointerdown={startPushToTalk}
		onpointerup={stopPushToTalk}
		onpointercancel={stopPushToTalk}
		onlostpointercapture={stopPushToTalk}
		disabled={!voiceStore.isSupported}
		class="relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 focus:outline-none {!voiceStore.isSupported
			? 'bg-soft-dark-blue/50 text-slate-gray/40 cursor-not-allowed opacity-50'
			: voiceStore.isListening
				? 'bg-cyan-glow text-deep-navy shadow-cyan-glow cursor-pointer'
				: 'bg-soft-dark-blue text-slate-gray hover:bg-slate-gray/10 hover:text-pale-silver cursor-pointer'}"
		title={!voiceStore.isSupported
			? 'Speech recognition is not supported in this browser'
			: voiceStore.isListening
				? 'Listening… release or tap to stop'
				: 'Hold to talk, or tap to start'}
		aria-label={voiceStore.isListening ? 'Stop voice dictation' : 'Start voice dictation'}
	>
		<!-- Pulsing background shadow -->
		{#if voiceStore.isListening}
			<span class="absolute inset-0 rounded-full bg-cyan-glow/30 animate-ping"></span>
		{/if}

		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
			class="w-5 h-5"
		>
			{#if voiceStore.isListening}
				<!-- Animated Microphone Waves or Stop Square -->
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
				/>
			{:else}
				<!-- Mic Icon -->
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
				/>
			{/if}
		</svg>
	</button>
{/if}

<style>
	.shadow-cyan-glow {
		box-shadow: 0 0 15px rgba(34, 211, 238, 0.6);
	}
</style>
