<script lang="ts">
	import { moodStore, MOODS } from '$lib/stores/mood.svelte';
	import MoodCheckIn from '$lib/components/MoodCheckIn.svelte';
	import MoodIcon from '$lib/components/MoodIcon.svelte';
	import { characterStore } from '$lib/stores/character.svelte';
	import { MessageCircle, NotebookTabs } from 'lucide-svelte';

	let todayLog = $derived.by(() => {
		if (moodStore.logs.length === 0) return null;
		const todayStr = new Date().toDateString();
		return (
			moodStore.logs.find((log) => new Date(log.createdAt).toDateString() === todayStr) || null
		);
	});

	let todayMoodDetails = $derived.by(() => {
		if (!todayLog) return null;
		return MOODS.find((m) => m.label === todayLog.moodLabel) || null;
	});

	// Get a welcome message based on active character
	let greetingMessage = $derived.by(() => {
		const name = characterStore.activeCharacter.name;
		if (todayLog) {
			return `Glad to see you checked in today. I'm here as ${name} to reflect on whatever you need.`;
		} else {
			return `Hello. I am ${name}, your navigator. Let's start with a small check-in to see how you are carrying your day.`;
		}
	});
</script>

<div class="space-y-8 flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full py-4">
	<!-- Top Hero Branding -->
	<div class="text-center space-y-3">
		<h1 class="text-3xl md:text-4xl font-extrabold tracking-tight text-soft-white select-none">
			Welcome to <span class="text-moon-yellow">MOONDAY</span>
		</h1>
		<p class="text-sm text-slate-gray max-w-md mx-auto">
			{greetingMessage}
		</p>
	</div>

	<!-- Today Summary or Mood Check-In -->
	{#if !moodStore.checkedInToday}
		<!-- Show Mood check-in if they haven't checked in today -->
		<div class="animate-[fadeIn_0.5s_ease-out]">
			<MoodCheckIn />
		</div>
	{:else}
		<!-- Show checked in summary if checked in -->
		<div
			class="bg-soft-dark-blue border border-slate-gray/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl text-center max-w-xl mx-auto w-full animate-[fadeIn_0.5s_ease-out]"
		>
			<div class="space-y-2">
				<span class="text-xs font-semibold text-slate-gray uppercase tracking-wider block"
					>Today's Reflection</span
				>
				<h2 class="text-2xl font-bold text-soft-white">Check-in Complete</h2>
			</div>

			<!-- Large Mood Visual -->
			{#if todayLog && todayMoodDetails}
				<div
					class="flex flex-col items-center justify-center p-6 bg-deep-navy/40 rounded-2xl border border-slate-gray/5"
				>
					<span class="mb-3 text-violet-glow" aria-hidden="true">
						<MoodIcon name={todayMoodDetails.icon} size={48} strokeWidth={1.4} />
					</span>
					<span class="text-lg font-bold capitalize text-soft-white mb-1">{todayLog.moodLabel}</span
					>

					<!-- Levels grid -->
					<div
						class="grid grid-cols-2 gap-6 w-full max-w-xs mt-4 pt-4 border-t border-slate-gray/10 text-xs font-semibold text-slate-gray font-mono"
					>
						<div class="text-center">
							<span class="block text-[10px] uppercase text-slate-gray mb-1">Energy Level</span>
							<span class="text-cyan-glow text-sm">{todayLog.energyLevel} / 5</span>
						</div>
						<div class="text-center">
							<span class="block text-[10px] uppercase text-slate-gray mb-1">Stress Level</span>
							<span class="text-soft-red text-sm">{todayLog.stressLevel} / 5</span>
						</div>
					</div>

					<!-- Daily Note -->
					{#if todayLog.note}
						<div
							class="mt-4 p-3 bg-soft-dark-blue rounded-xl text-sm italic text-pale-silver max-w-sm w-full border border-slate-gray/10 text-center"
						>
							"{todayLog.note}"
						</div>
					{/if}
				</div>
			{/if}

			<div class="text-xs text-slate-gray max-w-sm mx-auto leading-relaxed select-none">
				You can update your check-in notes in the Journal, or discuss these feelings directly with
				your companion.
			</div>

			<!-- Navigation Buttons to other parts of app -->
			<div class="grid grid-cols-2 gap-3 pt-2">
				<a
					href="/chat"
					class="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-violet-glow text-deep-navy font-semibold text-sm hover:bg-violet-glow/90 shadow-md transition-all duration-300"
				>
					<MessageCircle size={17} aria-hidden="true" />
					<span>Open Reflections</span>
				</a>
				<a
					href="/journal"
					class="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-soft-dark-blue border border-slate-gray/10 text-soft-white font-semibold text-sm hover:bg-slate-gray/10 transition-all duration-300"
				>
					<NotebookTabs size={17} aria-hidden="true" />
					<span>View Journal</span>
				</a>
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
