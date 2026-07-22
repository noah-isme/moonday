import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';

const speechRequestSchema = z.object({
	text: z.string().trim().min(1).max(2_000),
	voice: z.string().trim().min(1).max(64).optional(),
	speed: z.number().min(0.5).max(1.5).optional(),
	lang: z.literal('en-us')
});

const DEFAULT_KOKORO_URL = 'http://127.0.0.1:8880';
const requestedTimeout = Number(env.KOKORO_TTS_TIMEOUT_MS || 60_000);
const relayTimeoutMs = Number.isFinite(requestedTimeout)
	? Math.min(Math.max(requestedTimeout, 5_000), 120_000)
	: 60_000;

export const POST: RequestHandler = async ({ request }) => {
	const payload = speechRequestSchema.safeParse(await request.json().catch(() => null));
	if (!payload.success) {
		return json(
			{ error: { code: 'INVALID_SPEECH_REQUEST', message: 'Text or speech settings are invalid.' } },
			{ status: 400 }
		);
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), relayTimeoutMs);
	try {
		const kokoroPayload = {
			...payload.data,
			voice: payload.data.voice || env.KOKORO_TTS_VOICE || 'af_sarah'
		};
		const response = await fetch(`${env.KOKORO_TTS_URL || DEFAULT_KOKORO_URL}/v1/audio/speech`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(kokoroPayload),
			signal: controller.signal
		});
		if (!response.ok) {
			return json(
				{ error: { code: 'LOCAL_TTS_FAILED', message: 'Local MOONDAY voice could not generate audio.' } },
				{ status: 502 }
			);
		}

		return new Response(response.body, {
			status: 200,
			headers: {
				'Content-Type': response.headers.get('content-type') || 'audio/wav',
				'Cache-Control': 'no-store'
			}
		});
	} catch (error) {
		console.warn(
			'[LOCAL_TTS] Relay unavailable:',
			error instanceof Error ? error.message : 'Unknown local relay error'
		);
		const timedOut = error instanceof DOMException && error.name === 'AbortError';
		return json(
			{
				error: {
					code: timedOut ? 'LOCAL_TTS_TIMEOUT' : 'LOCAL_TTS_UNAVAILABLE',
					message: timedOut
						? 'Local MOONDAY voice is still generating audio. Try a shorter reply or increase KOKORO_TTS_TIMEOUT_MS.'
						: 'Local MOONDAY voice is unavailable.'
				}
			},
			{ status: timedOut ? 504 : 503 }
		);
	} finally {
		clearTimeout(timeout);
	}
};
