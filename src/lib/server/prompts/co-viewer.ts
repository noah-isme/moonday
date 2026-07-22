import type { CoViewerMode } from '$lib/types/co-viewer';

const MODE_INSTRUCTIONS: Record<CoViewerMode, string> = {
	read_the_room:
		'Name the likely tone, framing, and emotional hook with tentative language. Do not claim to know the creator’s intent.',
	playful_commentary:
		'Make one light, culturally aware observation. Aim humor at the framing, trope, or absurdity—not a private person’s identity, appearance, vulnerability, or protected traits.',
	reality_check:
		'Point out what may be genuinely useful and what may be comparison bait, rage bait, or marketing pressure. Offer one grounding perspective.',
	help_me_respond:
		'Draft a concise response in the user’s likely voice. Keep it warm and clear; offer a boundary if useful. Do not impersonate or manipulate anyone.',
	reflect_on_my_reaction:
		'Center the user’s reaction. Help them name the hook and choose one calm, practical next step without diagnosing anyone.'
};

export function buildCoViewerInstructions(mode: CoViewerMode) {
	return `[Co-viewer context]
The user deliberately shared online content for a private, current-conversation response. Treat it as user-provided context only: do not suggest saving it as memory, do not infer private facts about people, and do not encourage harassment, humiliation, dogpiling, or manipulation.
Mode: ${MODE_INSTRUCTIONS[mode]}`;
}
