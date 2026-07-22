const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function validatePublicHttpUrl(value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error('Enter a valid public http(s) URL.');
	}
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (!['http:', 'https:'].includes(url.protocol) || BLOCKED_HOSTS.has(host) || host.includes(':')) {
		throw new Error('Only public http(s) URLs can be previewed.');
	}
	if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) {
		throw new Error('Private network URLs cannot be previewed.');
	}
	return url.toString();
}

export function previewTitle(url: string, markdown: string) {
	const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
	return heading || new URL(url).hostname;
}
