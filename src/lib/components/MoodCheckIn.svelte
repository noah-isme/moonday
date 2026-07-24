<script lang="ts">
	import { moodStore, MOODS } from '$lib/stores/mood.svelte';
	import { uiStore } from '$lib/stores/ui.svelte';
	import MoodIcon from './MoodIcon.svelte';
	import { ChevronDown } from 'lucide-svelte';

	let { onCheckedIn } = $props<{
		onCheckedIn?: () => void;
	}>();

	let checkInState = $derived(moodStore.currentCheckIn);
	let showDetails = $state(false);

	function handleMoodSelect(label: string) {
		moodStore.selectMood(label);
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		await moodStore.submitCheckIn();
		uiStore.setNotice('Mood reflection saved. MOONDAY will carry this forward.');
		if (onCheckedIn) {
			onCheckedIn();
		}
	}
</script>

<div class="ambient-panel mx-auto w-full max-w-xl rounded-[2rem] p-6 shadow-xl">
	<div class="text-center mb-6">
		<p class="eyebrow mb-2">Quick signal check</p>
		<h2 class="font-display text-2xl font-bold tracking-tight text-soft-white">
			What’s the vibe right now?
		</h2>
		<p class="mt-2 text-sm text-slate-gray">
			Pick the closest answer. Your feelings are allowed to be annoyingly nuanced.
		</p>
	</div>

	<form onsubmit={handleSubmit} class="space-y-6">
		<!-- Mood selection grid -->
		<div>
			<p class="block text-xs font-semibold text-slate-gray uppercase tracking-wider mb-3">
				Select Current Mood
			</p>
			<div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
				{#each MOODS as mood (mood.label)}
					<button
						type="button"
						onclick={() => handleMoodSelect(mood.label)}
						class="flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer select-none {checkInState.moodLabel ===
						mood.label
							? 'border-cyan-glow/55 bg-cyan-glow/12 scale-[1.03] shadow-[0_0_22px_rgba(103,230,210,0.08)]'
							: 'border-cyan-glow/8 bg-deep-navy/40 hover:border-cyan-glow/25 hover:scale-[1.02]'}"
					>
						<span class="mb-2 text-current" aria-hidden="true">
							<MoodIcon name={mood.icon} size={26} strokeWidth={1.7} />
						</span>
						<span
							class="text-xs capitalize font-medium"
							class:text-cyan-glow={checkInState.moodLabel === mood.label}
							class:text-pale-silver={checkInState.moodLabel !== mood.label}
						>
							{mood.label}
						</span>
					</button>
				{/each}
			</div>
		</div>

		<button
			type="button"
			onclick={() => (showDetails = !showDetails)}
			class="dark-section flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-pale-silver transition-colors hover:border-cyan-glow/30"
			aria-expanded={showDetails}
		>
			<span>{showDetails ? 'Hide optional details' : 'Add energy, stress, or a note'}</span>
			<ChevronDown
				size={17}
				class="text-cyan-glow transition-transform {showDetails ? 'rotate-180' : ''}"
				aria-hidden="true"
			/>
		</button>

		{#if showDetails}
			<!-- Energy and Stress Sliders -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<!-- Energy Slider -->
				<div class="space-y-2">
					<div
						class="flex justify-between items-center text-xs font-semibold text-slate-gray uppercase tracking-wider"
					>
						<span>Energy Level</span>
						<span class="text-cyan-glow normal-case font-bold">{checkInState.energyLevel} / 5</span>
					</div>
					<input
						type="range"
						min="1"
						max="5"
						bind:value={moodStore.currentCheckIn.energyLevel}
						class="w-full accent-cyan-glow bg-deep-navy h-2 rounded-lg cursor-pointer"
					/>
					<div class="flex justify-between text-[10px] text-slate-gray select-none">
						<span>Exhausted</span>
						<span>Hyperactive</span>
					</div>
				</div>

				<!-- Stress Slider -->
				<div class="space-y-2">
					<div
						class="flex justify-between items-center text-xs font-semibold text-slate-gray uppercase tracking-wider"
					>
						<span>Stress Level</span>
						<span class="text-soft-red normal-case font-bold">{checkInState.stressLevel} / 5</span>
					</div>
					<input
						type="range"
						min="1"
						max="5"
						bind:value={moodStore.currentCheckIn.stressLevel}
						class="w-full accent-soft-red bg-deep-navy h-2 rounded-lg cursor-pointer"
					/>
					<div class="flex justify-between text-[10px] text-slate-gray select-none">
						<span>Zen / Calm</span>
						<span>Overwhelmed</span>
					</div>
				</div>
			</div>

			<!-- Reflection Note -->
			<div class="space-y-2">
				<label
					for="reflection-note"
					class="block text-xs font-semibold text-slate-gray uppercase tracking-wider"
					>Reflection Note (Optional)</label
				>
				<textarea
					id="reflection-note"
					bind:value={moodStore.currentCheckIn.note}
					placeholder="Write a brief note about what is on your mind..."
					rows="3"
					class="w-full p-3 text-sm rounded-xl bg-deep-navy border border-slate-gray/10 text-soft-white placeholder-slate-gray outline-none focus:border-cyan-glow/35 transition-all duration-300"
				></textarea>
			</div>
		{/if}

		<!-- Submit Button -->
		<button
			type="submit"
			class="primary-action w-full cursor-pointer rounded-xl px-4 py-3 font-bold active:scale-[0.98]"
		>
			Log this mood
		</button>
	</form>
</div>
