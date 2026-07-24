import crypto from 'crypto';

let env: Record<string, unknown> = {};

// Load SvelteKit's dynamic private env asynchronously to avoid static analysis issues in CLI tools like drizzle-kit
import('$env/dynamic/private')
	.then((m) => {
		env = m.env || {};
	})
	.catch(() => {
		// Fallback to process.env under CLI/tests context
	});

// A test-only key override to simulate key issues during testing
let testKeyOverride: string | undefined | null = null;

/**
 * Sets a temporary key override for testing purposes.
 * Pass null to clear the override.
 */
export function setTestKeyOverride(key: string | undefined | null) {
	testKeyOverride = key;
}

function getKey(): string {
	if (testKeyOverride !== null) {
		if (testKeyOverride === undefined) {
			throw new Error('ENCRYPTION_KEY is not defined');
		}
		const keyBuffer = Buffer.from(testKeyOverride, 'utf8');
		if (keyBuffer.byteLength !== 32) {
			throw new Error('ENCRYPTION_KEY must be exactly 32 bytes');
		}
		return testKeyOverride;
	}

	let key = (env.ENCRYPTION_KEY as string) || process.env.ENCRYPTION_KEY;

	// Fallback to a default key in test environment if none is configured
	if (!key && process.env.NODE_ENV === 'test') {
		key = 'abcdefghijklmnopqrstuvwxyz123456';
	}

	if (!key) {
		throw new Error('ENCRYPTION_KEY is not defined');
	}
	const keyBuffer = Buffer.from(key, 'utf8');
	if (keyBuffer.byteLength !== 32) {
		throw new Error('ENCRYPTION_KEY must be exactly 32 bytes');
	}
	return key;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * @param text The plaintext string to encrypt.
 * @returns The encrypted string in the format: ivHex:authTagHex:encryptedTextHex
 */
export function encrypt(text: string): string {
	const key = getKey();
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
	let encrypted = cipher.update(text, 'utf8', 'hex');
	encrypted += cipher.final('hex');
	const authTag = cipher.getAuthTag().toString('hex');
	return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a hash using AES-256-GCM.
 * If the format is invalid, returns the input string itself as a safe fallback.
 * @param hash The encrypted hash in the format: ivHex:authTagHex:encryptedTextHex
 * @returns The decrypted plaintext string.
 */
export function decrypt(hash: string): string {
	const key = getKey();
	const parts = hash.split(':');
	if (parts.length !== 3) {
		return hash;
	}
	const [ivHex, authTagHex, encryptedTextHex] = parts;

	// Basic validation of standard lengths
	if (ivHex.length !== 24 || authTagHex.length !== 32) {
		return hash;
	}

	const decipher = crypto.createDecipheriv(
		'aes-256-gcm',
		Buffer.from(key, 'utf8'),
		Buffer.from(ivHex, 'hex')
	);
	decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
	let decrypted = decipher.update(encryptedTextHex, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}
