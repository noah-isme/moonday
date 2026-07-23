<script lang="ts">
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { onMount } from 'svelte';
	import { Mic, Square } from 'lucide-svelte';

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

	onMount(() => {
		voiceStore.initialize();
	});

	function handleVoiceClick() {
		if (voiceStore.isTranscribing) return;
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
</script>

{#if settingsStore.voiceInputEnabled}
	<button
		type="button"
		onclick={handleVoiceClick}
		disabled={!voiceStore.isSupported || voiceStore.isTranscribing}
		class="relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 focus:outline-none {!voiceStore.isSupported
			? 'bg-soft-dark-blue/50 text-slate-gray/40 cursor-not-allowed opacity-50'
			: voiceStore.isListening
				? 'bg-cyan-glow text-deep-navy shadow-cyan-glow cursor-pointer'
				: 'bg-soft-dark-blue text-slate-gray hover:bg-slate-gray/10 hover:text-pale-silver cursor-pointer'}"
		title={!voiceStore.isSupported
			? 'Microphone recording is not supported in this browser'
			: voiceStore.isTranscribing
				? 'Transcribing your recording…'
				: voiceStore.isListening
					? 'Listening… tap to stop'
					: 'Tap to start dictation'}
		aria-label={voiceStore.isListening ? 'Stop voice dictation' : 'Start voice dictation'}
	>
		<!-- Pulsing background shadow -->
		{#if voiceStore.isListening}
			<span class="absolute inset-0 rounded-full bg-cyan-glow/30 animate-ping"></span>
		{/if}

		{#if voiceStore.isListening}
			<Square size={17} fill="currentColor" aria-hidden="true" />
		{:else}
			<Mic size={20} aria-hidden="true" />
		{/if}
	</button>
{/if}

<style>
	.shadow-cyan-glow {
		box-shadow: 0 0 15px rgba(34, 211, 238, 0.6);
	}
</style>
