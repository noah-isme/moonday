import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const contentLength = Number(request.headers.get('content-length') || 0);
		if (contentLength > MAX_AUDIO_BYTES) {
			return json(
				{ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Audio must be smaller than 12 MB.' } },
				{ status: 413 }
			);
		}
		if (!env.GROQ_API_KEY && !process.env.GROQ_API_KEY) {
			return json(
				{
					error: {
						code: 'TRANSCRIPTION_UNAVAILABLE',
						message: 'Groq transcription is not configured.'
					}
				},
				{ status: 503 }
			);
		}
		const formData = await request.formData();
		const audio = formData.get('audio');
		const language = formData.get('language');
		if (!(audio instanceof File) || !audio.size) {
			return json(
				{
					error: { code: 'INVALID_AUDIO', message: 'Record audio before requesting a transcript.' }
				},
				{ status: 400 }
			);
		}
		if (
			audio.size > MAX_AUDIO_BYTES ||
			!['audio/webm', 'audio/ogg', 'audio/mp4'].includes(audio.type.split(';')[0])
		) {
			return json(
				{
					error: {
						code: 'INVALID_AUDIO',
						message: 'Use a WebM, OGG, or MP4 recording smaller than 12 MB.'
					}
				},
				{ status: 400 }
			);
		}
		const groqForm = new FormData();
		groqForm.append('file', audio, 'dictation.webm');
		groqForm.append('model', 'whisper-large-v3');
		groqForm.append('response_format', 'json');
		if (language === 'en' || language === 'id') groqForm.append('language', language);
		const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
			method: 'POST',
			headers: { Authorization: `Bearer ${env.GROQ_API_KEY || process.env.GROQ_API_KEY}` },
			body: groqForm
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) {
			return json(
				{
					error: {
						code: 'TRANSCRIPTION_FAILED',
						message: 'Groq could not transcribe this recording. Please try again.'
					}
				},
				{ status: 502 }
			);
		}
		return json({ text: typeof data?.text === 'string' ? data.text : '' });
	} catch {
		return json(
			{
				error: {
					code: 'TRANSCRIPTION_ERROR',
					message: 'Unable to transcribe audio. Please try again.'
				}
			},
			{ status: 500 }
		);
	}
};
