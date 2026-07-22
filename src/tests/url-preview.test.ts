import { describe, expect, it } from 'vitest';
import { previewTitle, validatePublicHttpUrl } from '$lib/server/context/url-preview';

describe('URL preview safety', () => {
	it('accepts public HTTPS URLs', () => {
		expect(validatePublicHttpUrl('https://example.com/post')).toBe('https://example.com/post');
	});

	it('rejects local and private network targets', () => {
		expect(() => validatePublicHttpUrl('http://localhost:3000/private')).toThrow('public');
		expect(() => validatePublicHttpUrl('http://192.168.1.10/private')).toThrow('Private');
		expect(() => validatePublicHttpUrl('http://[::1]/private')).toThrow('public');
	});

	it('uses a fetched heading when available', () => {
		expect(previewTitle('https://example.com/article', '# A useful article\nBody')).toBe(
			'A useful article'
		);
	});
});
