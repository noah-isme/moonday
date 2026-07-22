import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { deepRead } from '$lib/server/tools/browser';
import { previewTitle, validatePublicHttpUrl } from '$lib/server/context/url-preview';

const schema = z.object({ url: z.string().trim().max(2048), confirmed: z.literal(true) });

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url: rawUrl } = schema.parse(await request.json());
		const url = validatePublicHttpUrl(rawUrl);
		const markdown = await deepRead(url);
		if (!markdown || markdown.startsWith('[System: Failed')) {
			return json({ error: { code: 'PREVIEW_UNAVAILABLE', message: 'MOONDAY could not fetch a preview for that link.' } }, { status: 422 });
		}
		return json({
			preview: {
				url,
				title: previewTitle(url, markdown),
				content: markdown.replace(/\s+/g, ' ').trim().slice(0, 5000)
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to preview that URL.';
		return json({ error: { code: 'INVALID_PREVIEW_REQUEST', message } }, { status: 400 });
	}
};
