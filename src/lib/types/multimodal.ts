export type ImageAttachment = {
	name: string;
	mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
	dataUrl: string;
};

export type UrlContext = {
	url: string;
	title: string;
	content: string;
};
