<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import CharacterSelector from '$lib/components/CharacterSelector.svelte';
	import ProviderSelector from '$lib/components/ProviderSelector.svelte';

	let { data, form } = $props<{
		data: { profile: any };
		form: { success?: boolean; error?: any; values?: any } | null;
	}>();

	let isSubmitting = $state(false);
	let expandedSections = $state({
		profile: true,
		companion: false,
		ai: false,
		voice: false,
		continuity: false,
		privacy: false
	});

	onMount(() => {
		if (window.matchMedia('(min-width: 768px)').matches) {
			expandedSections = {
				profile: true,
				companion: true,
				ai: true,
				voice: true,
				continuity: true,
				privacy: true
			};
		}
	});

	// Initialize local states from data.profile.communicationStyle or form values or defaults
	const commStyle = $derived.by(() => {
		if (form?.values?.communicationStyle) {
			try {
				return JSON.parse(form.values.communicationStyle);
			} catch (e) {
				console.error('Failed to parse form communicationStyle value:', e);
			}
		}
		return data.profile.communicationStyle || {};
	});

	let tone = $state('Empathetic');
	let formality = $state('Casual / Gen Z');
	let sarcasmLevelNum = $state(1);
	let warmth = $state(4);
	let directness = $state(3);
	let humor = $state(2);
	let responseLength = $state(2);
	let questionFrequency = $state(2);
	let curiosity = $state(3);
	let selectedPreset = $state<string | null>(null);

	const companionPresets = [
		{
			id: 'calm-operator',
			name: 'Calm Operator',
			description: 'Grounded, concise, steady under pressure.',
			tone: 'Straightforward',
			formality: 'Professional',
			sarcasm: 0,
			warmth: 3,
			directness: 4,
			humor: 1,
			responseLength: 2,
			questionFrequency: 1,
			curiosity: 2
		},
		{
			id: 'friendly-copilot',
			name: 'Friendly Copilot',
			description: 'Warm, practical, and collaborative.',
			tone: 'Empathetic',
			formality: 'Casual / Gen Z',
			sarcasm: 1,
			warmth: 5,
			directness: 3,
			humor: 3,
			responseLength: 3,
			questionFrequency: 3,
			curiosity: 4
		},
		{
			id: 'dryly-witty-observer',
			name: 'Dryly Witty Observer',
			description: 'Sharp observations with kind, restrained humor.',
			tone: 'Analytical',
			formality: 'To-the-point',
			sarcasm: 3,
			warmth: 3,
			directness: 4,
			humor: 4,
			responseLength: 2,
			questionFrequency: 2,
			curiosity: 4
		}
	] as const;

	// Synchronize when commStyle changes
	$effect(() => {
		const style = commStyle;
		if (style.tone) tone = style.tone;
		if (style.formality) formality = style.formality;
		if (style.sarcasmLevel) {
			const levelStr = String(style.sarcasmLevel).toLowerCase();
			if (levelStr === 'none' || levelStr === '0') sarcasmLevelNum = 0;
			else if (levelStr.includes('mild') || levelStr === '1' || levelStr === '2')
				sarcasmLevelNum = 2;
			else if (levelStr.includes('spicy') || levelStr === '3' || levelStr === '4')
				sarcasmLevelNum = 4;
			else if (levelStr.includes('unhinged') || levelStr.includes('brutal') || levelStr === '5')
				sarcasmLevelNum = 5;
		}
		if (Number.isFinite(Number(style.warmth))) warmth = Number(style.warmth);
		if (Number.isFinite(Number(style.directness))) directness = Number(style.directness);
		if (Number.isFinite(Number(style.humor))) humor = Number(style.humor);
		if (Number.isFinite(Number(style.responseLength)))
			responseLength = Number(style.responseLength);
		if (Number.isFinite(Number(style.questionFrequency)))
			questionFrequency = Number(style.questionFrequency);
		if (Number.isFinite(Number(style.curiosity))) curiosity = Number(style.curiosity);
	});

	// Derived Sarcasm Level string descriptor for storing in JSON
	let sarcasmLevel = $derived.by(() => {
		if (sarcasmLevelNum === 0) return 'none';
		if (sarcasmLevelNum <= 2) return 'mild';
		if (sarcasmLevelNum <= 4) return 'spicy';
		return 'unhinged / brutal';
	});

	// Pretty label for the UI
	let sarcasmLabel = $derived.by(() => {
		if (sarcasmLevelNum === 0) return 'None';
		if (sarcasmLevelNum <= 2) return 'Mild';
		if (sarcasmLevelNum <= 4) return 'Spicy';
		return 'Unhinged / Brutal';
	});

	let previewResponse = $derived.by(() => {
		const opening =
			tone === 'Empathetic' ? 'That sounds like a lot to carry.' : 'Let’s look at this clearly.';
		const warmthLine = warmth >= 4 ? 'You do not have to solve every part of it at once.' : '';
		const nextStep =
			directness >= 4
				? 'Pick one next step and do it for ten minutes.'
				: 'We can make the next step smaller.';
		const question = questionFrequency >= 4 ? ' What feels most important right now?' : '';
		const curiosityLine = curiosity >= 4 ? ' There may be a useful detail worth noticing.' : '';
		return `${opening} ${warmthLine} ${nextStep}${curiosityLine}${question}`
			.replace(/\s+/g, ' ')
			.trim();
	});

	function setPreference(id: string, value: number) {
		if (id === 'warmth') warmth = value;
		else if (id === 'directness') directness = value;
		else if (id === 'humor') humor = value;
		else if (id === 'responseLength') responseLength = value;
		else if (id === 'questionFrequency') questionFrequency = value;
		else if (id === 'curiosity') curiosity = value;
	}

	function applyPreset(preset: (typeof companionPresets)[number]) {
		selectedPreset = preset.id;
		tone = preset.tone;
		formality = preset.formality;
		sarcasmLevelNum = preset.sarcasm;
		warmth = preset.warmth;
		directness = preset.directness;
		humor = preset.humor;
		responseLength = preset.responseLength;
		questionFrequency = preset.questionFrequency;
		curiosity = preset.curiosity;
	}

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

	<!-- User Profile Section -->
	<details
		bind:open={expandedSections.profile}
		class="settings-section bg-[#141b2b] border border-[rgba(255,255,255,0.05)] rounded-3xl p-5 md:p-6 shadow-xl"
	>
		<summary class="flex items-center justify-between gap-3 cursor-pointer">
			<span class="text-sm font-bold text-soft-white uppercase tracking-wider">User Profile</span>
			<svg
				class="settings-chevron w-4 h-4 text-slate-gray"
				viewBox="0 0 20 20"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="m5 7.5 5 5 5-5"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</summary>
		<div class="pt-3 space-y-4">
			<p class="text-xs text-slate-gray">
				Customize your profile details and specify your communication style preferences.
			</p>

			{#if form?.success}
				<div
					class="p-3 bg-calm-green/10 border border-calm-green/20 rounded-xl text-xs text-calm-green flex items-center gap-2"
				>
					<span>✓</span>
					<span>Profile updated successfully!</span>
				</div>
			{/if}

			{#if form?.error?._form}
				<div
					class="p-3 bg-soft-red/10 border border-soft-red/20 rounded-xl text-xs text-soft-red flex items-center gap-2"
				>
					<span>⚠️</span>
					<span>{form.error._form}</span>
				</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-4 pt-2"
			>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Name Field -->
					<div class="flex flex-col gap-1.5">
						<label for="name" class="text-xs font-semibold text-pale-silver">User Name</label>
						<input
							type="text"
							id="name"
							name="name"
							disabled={isSubmitting}
							value={form?.values?.name ?? data.profile.name}
							class="w-full p-3 text-xs bg-[#141b2b] border border-[rgba(255,255,255,0.05)] rounded-xl text-soft-white focus:outline-none focus:ring-2 focus:ring-violet-glow/50 focus:border-violet-glow disabled:opacity-55 transition-all"
							placeholder="Noah"
						/>
						{#if form?.error?.name}
							<span class="text-[10px] text-soft-red font-semibold">{form.error.name[0]}</span>
						{/if}
					</div>

					<!-- Occupation Field -->
					<div class="flex flex-col gap-1.5">
						<label for="occupation" class="text-xs font-semibold text-pale-silver">Occupation</label
						>
						<input
							type="text"
							id="occupation"
							name="occupation"
							disabled={isSubmitting}
							value={form?.values?.occupation ?? data.profile.occupation ?? ''}
							class="w-full p-3 text-xs bg-[#141b2b] border border-[rgba(255,255,255,0.05)] rounded-xl text-soft-white focus:outline-none focus:ring-2 focus:ring-violet-glow/50 focus:border-violet-glow disabled:opacity-55 transition-all"
							placeholder="Software Architect"
						/>
						{#if form?.error?.occupation}
							<span class="text-[10px] text-soft-red font-semibold">{form.error.occupation[0]}</span
							>
						{/if}
					</div>
				</div>

				<!-- Bio Field -->
				<div class="flex flex-col gap-1.5">
					<label for="bio" class="text-xs font-semibold text-pale-silver">Bio</label>
					<textarea
						id="bio"
						name="bio"
						rows="3"
						disabled={isSubmitting}
						value={form?.values?.bio ?? data.profile.bio ?? ''}
						class="w-full p-3 text-xs bg-[#141b2b] border border-[rgba(255,255,255,0.05)] rounded-xl text-soft-white focus:outline-none focus:ring-2 focus:ring-violet-glow/50 focus:border-violet-glow disabled:opacity-55 transition-all resize-none"
						placeholder="Senior Software Architect..."></textarea>
					{#if form?.error?.bio}
						<span class="text-[10px] text-soft-red font-semibold">{form.error.bio[0]}</span>
					{/if}
				</div>

				<!-- Communication Style GUI Form -->
				<div class="space-y-4 p-4 bg-deep-navy/30 border border-slate-gray/5 rounded-2xl">
					<h3 class="text-xs font-bold text-soft-white uppercase tracking-wider">
						Communication Style
					</h3>

					<div class="grid gap-2 md:grid-cols-3">
						{#each companionPresets as preset}
							<button
								type="button"
								onclick={() => applyPreset(preset)}
								class="rounded-xl border p-3 text-left transition-colors {selectedPreset ===
								preset.id
									? 'border-violet-glow/60 bg-violet-glow/10'
									: 'border-slate-gray/10 bg-deep-navy/20 hover:border-violet-glow/30'}"
							>
								<span class="block text-xs font-semibold text-pale-silver">{preset.name}</span>
								<span class="mt-1 block text-[10px] text-slate-gray">{preset.description}</span>
							</button>
						{/each}
					</div>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<!-- Tone Dropdown -->
						<div class="flex flex-col gap-1.5">
							<label for="tone" class="text-xs font-semibold text-pale-silver">Tone</label>
							<select
								id="tone"
								bind:value={tone}
								disabled={isSubmitting}
								class="w-full p-2.5 text-xs bg-[#141b2b] border border-[rgba(255,255,255,0.05)] rounded-xl text-soft-white focus:outline-none focus:ring-2 focus:ring-violet-glow/50 focus:border-violet-glow disabled:opacity-55 transition-all cursor-pointer"
							>
								<option value="Straightforward">Straightforward</option>
								<option value="Sarcastic / Roasting">Sarcastic / Roasting</option>
								<option value="Empathetic">Empathetic</option>
								<option value="Analytical">Analytical</option>
							</select>
						</div>

						<!-- Formality Dropdown -->
						<div class="flex flex-col gap-1.5">
							<label for="formality" class="text-xs font-semibold text-pale-silver">Formality</label
							>
							<select
								id="formality"
								bind:value={formality}
								disabled={isSubmitting}
								class="w-full p-2.5 text-xs bg-[#141b2b] border border-[rgba(255,255,255,0.05)] rounded-xl text-soft-white focus:outline-none focus:ring-2 focus:ring-violet-glow/50 focus:border-violet-glow disabled:opacity-55 transition-all cursor-pointer"
							>
								<option value="Casual / Gen Z">Casual / Gen Z</option>
								<option value="Professional">Professional</option>
								<option value="To-the-point">To-the-point</option>
							</select>
						</div>

						<!-- Sarcasm Level Slider -->
						<div class="flex flex-col gap-1.5">
							<div class="flex justify-between items-center">
								<label for="sarcasmLevelRange" class="text-xs font-semibold text-pale-silver"
									>Sarcasm Level</label
								>
								<span class="text-xs font-bold text-violet-glow font-mono">{sarcasmLabel}</span>
							</div>
							<div class="flex items-center gap-3 py-1">
								<span class="text-[10px] text-slate-gray">None</span>
								<input
									type="range"
									id="sarcasmLevelRange"
									min="0"
									max="5"
									bind:value={sarcasmLevelNum}
									disabled={isSubmitting}
									class="flex-1 h-1.5 bg-[#141b2b] rounded-lg appearance-none cursor-pointer accent-violet-glow border border-slate-gray/10"
								/>
								<span class="text-[10px] text-slate-gray font-semibold">Brutal</span>
							</div>
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-1">
						{#each [{ id: 'warmth', label: 'Warmth', value: warmth }, { id: 'directness', label: 'Directness', value: directness }, { id: 'humor', label: 'Humor', value: humor }, { id: 'responseLength', label: 'Response length', value: responseLength }, { id: 'questionFrequency', label: 'Questions', value: questionFrequency }, { id: 'curiosity', label: 'Curiosity', value: curiosity }] as control}
							<div class="flex flex-col gap-1.5">
								<div class="flex items-center justify-between text-xs">
									<label for={control.id} class="font-semibold text-pale-silver"
										>{control.label}</label
									>
									<span class="font-mono text-violet-glow">{control.value}/5</span>
								</div>
								<input
									id={control.id}
									type="range"
									min="1"
									max="5"
									value={control.value}
									oninput={(event) =>
										setPreference(
											control.id,
											Number((event.currentTarget as HTMLInputElement).value)
										)}
									disabled={isSubmitting}
									class="w-full h-1.5 accent-violet-glow cursor-pointer disabled:opacity-55"
								/>
							</div>
						{/each}
					</div>

					<div class="rounded-xl border border-violet-glow/20 bg-violet-glow/5 p-3">
						<p class="text-[10px] font-bold uppercase tracking-wider text-violet-glow">
							Live reply preview
						</p>
						<p class="mt-1.5 text-xs leading-relaxed text-pale-silver">“{previewResponse}”</p>
					</div>

					<input
						type="hidden"
						name="communicationStyle"
						value={JSON.stringify({
							tone,
							formality,
							sarcasmLevel,
							warmth,
							directness,
							humor,
							responseLength,
							questionFrequency,
							curiosity,
							preset: selectedPreset
						})}
					/>

					{#if form?.error?.communicationStyle}
						<span class="text-[10px] text-soft-red font-semibold"
							>{form.error.communicationStyle[0]}</span
						>
					{/if}
				</div>

				<!-- Submit Button -->
				<div class="pt-2">
					<button
						type="submit"
						disabled={isSubmitting}
						class="py-2.5 px-4 rounded-xl border border-violet-glow/20 text-violet-glow bg-violet-glow/5 hover:bg-violet-glow/15 disabled:bg-slate-gray/10 disabled:text-slate-gray disabled:border-slate-gray/15 text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer flex items-center gap-2"
					>
						{#if isSubmitting}
							<span>Saving...</span>
						{:else}
							<span>Save Profile Settings</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</details>

	<!-- Companion Profile Selector -->
	<details
		bind:open={expandedSections.companion}
		class="settings-section bg-soft-dark-blue/40 border border-slate-gray/10 rounded-3xl p-5 md:p-6 shadow-xl"
	>
		<summary class="flex items-center justify-between gap-3 cursor-pointer">
			<span class="text-sm font-bold text-soft-white uppercase tracking-wider"
				>Companion Character Profile</span
			>
			<svg
				class="settings-chevron w-4 h-4 text-slate-gray"
				viewBox="0 0 20 20"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="m5 7.5 5 5 5-5"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</summary>
		<div class="pt-3 space-y-4">
			<p class="text-xs text-slate-gray">
				Select who navigates your feelings. Each character has unique tone, humor, and guidance
				patterns.
			</p>
			<div class="pt-2">
				<CharacterSelector />
			</div>
		</div>
	</details>

	<!-- Model & Provider Selector -->
	<details
		bind:open={expandedSections.ai}
		class="settings-section bg-soft-dark-blue/40 border border-slate-gray/10 rounded-3xl p-5 md:p-6 shadow-xl"
	>
		<summary class="flex items-center justify-between gap-3 cursor-pointer">
			<span class="text-sm font-bold text-soft-white uppercase tracking-wider"
				>AI Inference Settings</span
			>
			<svg
				class="settings-chevron w-4 h-4 text-slate-gray"
				viewBox="0 0 20 20"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="m5 7.5 5 5 5-5"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</summary>
		<div class="pt-3 space-y-4">
			<p class="text-xs text-slate-gray font-sans">
				Choose the backend engine that processes your daily conversations and performs cognitive
				task routing.
			</p>
			<div class="pt-2">
				<ProviderSelector />
			</div>
		</div>
	</details>

	<!-- Voice & Speech Toggles -->
	<details
		bind:open={expandedSections.voice}
		class="settings-section bg-soft-dark-blue/40 border border-slate-gray/10 rounded-3xl p-5 md:p-6 shadow-xl"
	>
		<summary class="flex items-center justify-between gap-3 cursor-pointer">
			<span class="text-sm font-bold text-soft-white uppercase tracking-wider"
				>Speech & Voice Controls</span
			>
			<svg
				class="settings-chevron w-4 h-4 text-slate-gray"
				viewBox="0 0 20 20"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="m5 7.5 5 5 5-5"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</summary>
		<div class="pt-3 space-y-4">
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
						>Web Speech API is not supported or partially blocked by your browser. Try opening
						MOONDAY in Chrome, Safari, or Microsoft Edge for the best experience.</span
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
						aria-label="Toggle voice dictation"
						aria-pressed={settingsStore.voiceInputEnabled}
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
						aria-label="Toggle speech synthesis"
						aria-pressed={settingsStore.voiceOutputEnabled}
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
		</div>
	</details>

	<!-- Daily continuity preferences -->
	<details
		bind:open={expandedSections.continuity}
		class="settings-section bg-[#141b2b] border border-[rgba(255,255,255,0.05)] rounded-3xl p-5 md:p-6 shadow-xl"
	>
		<summary class="flex items-center justify-between gap-3 cursor-pointer">
			<span class="text-sm font-bold text-pale-silver uppercase tracking-wider"
				>Daily continuity</span
			>
			<svg
				class="settings-chevron w-4 h-4 text-slate-gray"
				viewBox="0 0 20 20"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="m5 7.5 5 5 5-5"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</summary>
		<div class="pt-4 space-y-4">
			<p class="text-xs text-slate-gray">
				Show one optional, on-device daily prompt based on your approved goals, latest check-in, or
				unfinished conversation thread. MOONDAY never sends background notifications in v0.1.
			</p>
			<div
				class="flex items-center justify-between rounded-xl border border-slate-gray/10 bg-deep-navy/35 p-3"
			>
				<div>
					<p class="text-xs font-semibold text-pale-silver">Daily check-ins</p>
					<p class="text-[10px] text-slate-gray">You can always dismiss or start fresh.</p>
				</div>
				<button
					onclick={() => settingsStore.toggleProactiveCheckIns()}
					aria-label="Toggle daily check-ins"
					aria-pressed={settingsStore.proactiveCheckInsEnabled}
					class="w-9 h-5 rounded-full p-0.5 transition-colors {settingsStore.proactiveCheckInsEnabled
						? 'bg-violet-glow'
						: 'bg-slate-gray/30'}"
				>
					<div
						class="w-4 h-4 rounded-full bg-soft-white transition-transform"
						class:translate-x-4={settingsStore.proactiveCheckInsEnabled}
					></div>
				</button>
			</div>
			{#if settingsStore.proactiveCheckInsEnabled}
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="text-xs text-slate-gray"
						>Frequency
						<select
							value={settingsStore.proactiveCheckInFrequency}
							onchange={(event) =>
								settingsStore.setProactiveCheckInFrequency(
									(event.currentTarget as HTMLSelectElement).value as 'daily' | 'weekdays'
								)}
							class="mt-1.5 w-full rounded-xl border border-slate-gray/10 bg-deep-navy p-2.5 text-xs text-pale-silver"
						>
							<option value="daily">Every day</option><option value="weekdays">Weekdays only</option
							>
						</select>
					</label>
					<label class="text-xs text-slate-gray"
						>Preferred time
						<select
							value={settingsStore.proactiveCheckInTime}
							onchange={(event) =>
								settingsStore.setProactiveCheckInTime(
									(event.currentTarget as HTMLSelectElement).value as
										'morning' | 'afternoon' | 'evening'
								)}
							class="mt-1.5 w-full rounded-xl border border-slate-gray/10 bg-deep-navy p-2.5 text-xs text-pale-silver"
						>
							<option value="morning">Morning</option><option value="afternoon">Afternoon</option
							><option value="evening">Evening</option>
						</select>
					</label>
				</div>
			{/if}
		</div>
	</details>

	<!-- Dangerous Zone (Data clearance) -->
	<details
		bind:open={expandedSections.privacy}
		class="settings-section bg-soft-red/5 border border-soft-red/10 rounded-3xl p-5 md:p-6 shadow-xl"
	>
		<summary class="flex items-center justify-between gap-3 cursor-pointer">
			<span class="text-sm font-bold text-soft-red uppercase tracking-wider">Danger Zone</span>
			<svg
				class="settings-chevron w-4 h-4 text-soft-red/70"
				viewBox="0 0 20 20"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="m5 7.5 5 5 5-5"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</summary>
		<div class="pt-3 space-y-4">
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
		</div>
	</details>
</div>
