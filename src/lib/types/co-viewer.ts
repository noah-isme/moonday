export const CO_VIEWER_MODES = [
	'read_the_room',
	'playful_commentary',
	'reality_check',
	'help_me_respond',
	'reflect_on_my_reaction'
] as const;

export type CoViewerMode = (typeof CO_VIEWER_MODES)[number];

export const CO_VIEWER_MODE_DETAILS: Record<CoViewerMode, { label: string; description: string }> = {
	read_the_room: {
		label: 'Read the room',
		description: 'Name the tone and emotional hook, without pretending to know intent.'
	},
	playful_commentary: {
		label: 'Playful commentary',
		description: 'Make a light observation about the post or internet trope, never the person.'
	},
	reality_check: {
		label: 'Reality check',
		description: 'Separate useful ideas from comparison bait, rage bait, or marketing pressure.'
	},
	help_me_respond: {
		label: 'Help me respond',
		description: 'Draft a warm, clear reply, comment, caption, or boundary.'
	},
	reflect_on_my_reaction: {
		label: 'Reflect on my reaction',
		description: 'Focus on what this brought up for you, not on judging the creator.'
	}
};
