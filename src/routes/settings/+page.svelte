<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import CharacterSelector from '$lib/components/CharacterSelector.svelte';
	import ProviderSelector from '$lib/components/ProviderSelector.svelte';

	function handleClearData() {
		const verified = confirm(
			'WARNING: This will permanently wipe all local storage data, including your conversation logs, check-in history, and saved memories. This action cannot be undone.\n\nDo you want to proceed?'
		);
		if (verified) {
			settingsStore.clearAllData();
		}
	}
</script>

<div class="space-y-8 select-none max-w-3xl mx-auto w-full">
	<!-- Page Header -->
	<div class="space-y-2">
		<h1 class="text-2xl font-extrabold text-soft-white tracking-tight">System Settings</h1>
		<p class="text-xs text-slate-gray">
			Configure companion personality, model routing, voice parameters, and memory privacy.
		</p>
	</div>

	<!-- Companion Profile Selector -->
	<section
		class="bg-soft-dark-blue/40 border border-slate-gray/10 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl"
	>
		<h2 class="text-sm font-bold text-soft-white uppercase tracking-wider flex items-center gap-2">
			<span>Companion Character Profile</span>
		</h2>
		<p class="text-xs text-slate-gray">
			Select who navigates your feelings. Each character has unique tone, humor, and guidance
			patterns.
		</p>
		<div class="pt-2">
			<CharacterSelector />
		</div>
	</section>

	<!-- Model & Provider Selector -->
	<section
		class="bg-soft-dark-blue/40 border border-slate-gray/10 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl"
	>
		<h2 class="text-sm font-bold text-soft-white uppercase tracking-wider">
			AI Inference Settings
		</h2>
		<p class="text-xs text-slate-gray font-sans">
			Choose the backend engine that processes your daily conversations and performs cognitive task
			routing.
		</p>
		<div class="pt-2">
			<ProviderSelector />
		</div>
	</section>

	<!-- Voice & Speech Toggles -->
	<section
		class="bg-soft-dark-blue/40 border border-slate-gray/10 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl"
	>
		<h2 class="text-sm font-bold text-soft-white uppercase tracking-wider">
			Speech & Voice Controls
		</h2>
		<p class="text-xs text-slate-gray">
			Control microphone speech-to-text dictation and synthesized reading of responses in the
			browser.
		</p>

		<!-- Voice API Support Banner -->
		{#if !voiceStore.isSupported}
			<div
				class="p-3.5 bg-soft-red/10 border border-soft-red/20 rounded-xl text-xs text-soft-red/80 flex items-start gap-2.5 leading-normal"
			>
				<span>⚠️</span>
				<span
					>Web Speech API is not supported or partially blocked by your browser. Try opening MOONDAY
					in Chrome, Safari, or Microsoft Edge for the best experience.</span
				>
			</div>
		{/if}

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
			<!-- Voice Input Toggle -->
			<div
				class="flex items-center justify-between p-4 bg-deep-navy/40 border border-slate-gray/5 rounded-2xl"
			>
				<div class="flex flex-col">
					<span class="text-xs font-semibold text-pale-silver">Voice Dictation (Input)</span>
					<span class="text-[9px] text-slate-gray mt-0.5">Toggle browser microphone access</span>
				</div>
				<button
					onclick={() => settingsStore.toggleVoiceInput()}
					class="w-9 h-5 rounded-full p-0.5 transition-colors duration-300 cursor-pointer {settingsStore.voiceInputEnabled
						? 'bg-cyan-glow'
						: 'bg-slate-gray/30'}"
					disabled={!voiceStore.isSupported}
				>
					<div
						class="w-4 h-4 rounded-full bg-soft-white transition-transform duration-300"
						class:translate-x-4={settingsStore.voiceInputEnabled}
					></div>
				</button>
			</div>

			<!-- Voice Output Toggle -->
			<div
				class="flex items-center justify-between p-4 bg-deep-navy/40 border border-slate-gray/5 rounded-2xl"
			>
				<div class="flex flex-col">
					<span class="text-xs font-semibold text-pale-silver">Speech Synthesis (Output)</span>
					<span class="text-[9px] text-slate-gray mt-0.5"
						>Speak assistant replies automatically</span
					>
				</div>
				<button
					onclick={() => settingsStore.toggleVoiceOutput()}
					class="w-9 h-5 rounded-full p-0.5 transition-colors duration-300 cursor-pointer {settingsStore.voiceOutputEnabled
						? 'bg-violet-glow'
						: 'bg-slate-gray/30'}"
					disabled={!voiceStore.isSupported}
				>
					<div
						class="w-4 h-4 rounded-full bg-soft-white transition-transform duration-300"
						class:translate-x-4={settingsStore.voiceOutputEnabled}
					></div>
				</button>
			</div>
		</div>
	</section>

	<!-- Dangerous Zone (Data clearance) -->
	<section
		class="bg-soft-red/5 border border-soft-red/10 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl"
	>
		<h2 class="text-sm font-bold text-soft-red uppercase tracking-wider">Danger Zone</h2>
		<p class="text-xs text-slate-gray">
			Wipe all cached profiles, chats, and reflections stored locally on your device.
		</p>

		<div class="pt-2 select-none">
			<button
				onclick={handleClearData}
				class="py-2.5 px-4 rounded-xl border border-soft-red/20 text-soft-red bg-soft-red/5 hover:bg-soft-red/15 text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer"
			>
				Permanently Clear All Local Data
			</button>
		</div>
	</section>
</div>
