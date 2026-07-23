<script lang="ts">
	import {
		CloudRain,
		Frown,
		Gauge,
		Heart,
		Laugh,
		Meh,
		Moon,
		Rocket,
		Sparkles,
		Target,
		UserRound,
		Wind
	} from 'lucide-svelte';
	import type { MoodIconName } from '$lib/stores/mood.svelte';

	let {
		name,
		size = 18,
		strokeWidth = 1.8,
		class: className = ''
	} = $props<{
		name: MoodIconName;
		size?: number;
		strokeWidth?: number;
		class?: string;
	}>();

	const icons = {
		happy: Laugh,
		motivated: Rocket,
		hopeful: Sparkles,
		calm: Moon,
		neutral: Meh,
		tired: Gauge,
		confused: Wind,
		anxious: Heart,
		sad: CloudRain,
		lonely: UserRound,
		angry: Frown,
		overwhelmed: Target
	} as const;

	let Icon = $derived(icons[name as MoodIconName]);
</script>

<Icon {size} {strokeWidth} class={className} aria-hidden="true" />
