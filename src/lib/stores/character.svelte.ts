import { browser } from '$app/environment';

export interface CharacterProfile {
	id: string;
	name: string;
	description: string;
	tone: string;
	humorLevel: number; // 1-5
	sarcasmLevel: number; // 1-5
	emotionalWarmth: number; // 1-5
	moralDirectness: number; // 1-5
	avatarState: 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'concerned' | 'sleepy';
}

export const CHARACTERS: CharacterProfile[] = [
	{
		id: 'friendly',
		name: 'Friendly MOONDAY',
		description: 'Warm, reflective, gently witty, practical, and highly empathetic.',
		tone: 'warm & empathetic',
		humorLevel: 3,
		sarcasmLevel: 1,
		emotionalWarmth: 5,
		moralDirectness: 3,
		avatarState: 'happy'
	},
	{
		id: 'calm',
		name: 'Calm MOONDAY',
		description: 'Serene, slow-paced, grounding, and peaceful. Perfect for unwinding.',
		tone: 'peaceful & meditative',
		humorLevel: 1,
		sarcasmLevel: 1,
		emotionalWarmth: 4,
		moralDirectness: 2,
		avatarState: 'idle'
	},
	{
		id: 'sarcastic',
		name: 'Sarcastic MOONDAY',
		description:
			'Brutally honest, highly analytical, sharp-tongued, and roasts user flaws without corporate sugarcoating. Never mean just to be toxic, but communicates brutal truth with wit and Gen Z sarcasm.',
		tone: 'brutally honest & sarcastic',
		humorLevel: 4,
		sarcasmLevel: 5,
		emotionalWarmth: 3,
		moralDirectness: 3,
		avatarState: 'sleepy'
	},
	{
		id: 'mentor',
		name: 'Mentor MOONDAY',
		description: 'Focused on growth, asking tough but constructive questions to guide you.',
		tone: 'encouraging & analytical',
		humorLevel: 2,
		sarcasmLevel: 1,
		emotionalWarmth: 4,
		moralDirectness: 5,
		avatarState: 'concerned'
	},
	{
		id: 'silent_listener',
		name: 'Silent Listener MOONDAY',
		description: 'A quiet, non-judgmental space to vent. Very short and supportive feedback.',
		tone: 'passive & supportive',
		humorLevel: 1,
		sarcasmLevel: 0,
		emotionalWarmth: 4,
		moralDirectness: 1,
		avatarState: 'idle'
	}
];

export class CharacterStore {
	list = $state(CHARACTERS);
	activeId = $state<string>('friendly');

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('moonday_active_character_id');
			if (saved && CHARACTERS.some((c) => c.id === saved)) {
				this.activeId = saved;
			}

			$effect.root(() => {
				$effect(() => {
					localStorage.setItem('moonday_active_character_id', this.activeId);
				});
			});
		}
	}

	get activeCharacter(): CharacterProfile {
		return this.list.find((c) => c.id === this.activeId) || this.list[0];
	}

	selectCharacter(id: string) {
		if (this.list.some((c) => c.id === id)) {
			this.activeId = id;
		}
	}
}

export const characterStore = new CharacterStore();
