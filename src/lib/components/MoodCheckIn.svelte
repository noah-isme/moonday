<script lang="ts">
	import { moodStore, MOODS } from '$lib/stores/mood.svelte';

	let { onCheckedIn } = $props<{
		onCheckedIn?: () => void;
	}>();

	let checkInState = $derived(moodStore.currentCheckIn);

	function handleMoodSelect(label: string) {
		moodStore.selectMood(label);
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		await moodStore.submitCheckIn();
		if (onCheckedIn) {
			onCheckedIn();
		}
	}
</script>

<div
	class="bg-soft-dark-blue p-6 rounded-3xl border border-slate-gray/10 shadow-xl max-w-xl mx-auto w-full"
>
	<div class="text-center mb-6">
		<h2 class="text-xl font-bold text-soft-white tracking-wide">How are you feeling right now?</h2>
		<p class="text-xs text-slate-gray mt-1">
			Select a mood and note down your levels to help MOONDAY navigate your patterns.
		</p>
	</div>

	<form onsubmit={handleSubmit} class="space-y-6">
		<!-- Mood Emoji Selection Grid -->
		<div>
			<label class="block text-xs font-semibold text-slate-gray uppercase tracking-wider mb-3"
				>Select Current Mood</label
			>
			<div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
				{#each MOODS as mood}
					<button
						type="button"
						onclick={() => handleMoodSelect(mood.label)}
						class="flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer select-none {checkInState.moodLabel ===
						mood.label
							? 'border-violet-glow bg-violet-glow/10 scale-[1.03]'
							: 'border-slate-gray/10 bg-deep-navy/40 hover:border-slate-gray/30 hover:scale-[1.02]'}"
					>
						<span class="text-2xl mb-1 filter drop-shadow-sm select-none">{mood.emoji}</span>
						<span
							class="text-xs capitalize font-medium"
							class:text-violet-glow={checkInState.moodLabel === mood.label}
							class:text-pale-silver={checkInState.moodLabel !== mood.label}
						>
							{mood.label}
						</span>
					</button>
				{/each}
			</div>
		</div>

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
				class="w-full p-3 text-sm rounded-xl bg-deep-navy border border-slate-gray/10 text-soft-white placeholder-slate-gray outline-none focus:border-violet-glow/30 transition-all duration-300"
			></textarea>
		</div>

		<!-- Submit Button -->
		<button
			type="submit"
			class="w-full py-3 px-4 rounded-xl bg-violet-glow text-deep-navy font-semibold hover:bg-violet-glow/90 shadow-lg shadow-violet-glow/10 active:scale-[0.98] transition-all duration-300 cursor-pointer"
		>
			Save Mood Reflection
		</button>
	</form>
</div>
