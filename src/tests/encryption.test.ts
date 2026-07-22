import { describe, it, expect, afterEach } from 'vitest';
import { encrypt, decrypt, setTestKeyOverride } from '../lib/server/db/encryption';

afterEach(() => {
	// Clear any test key overrides after each test
	setTestKeyOverride(null);
});

describe('Encryption Utilities', () => {
	it('should encrypt and decrypt to the exact original plaintext', () => {
		const testCases = [
			'Hello, MOONDAY!',
			'A long text containing symbols: @#$%^&*()_+ {}|:"<>? -=[]\\;,./',
			'',
			'{"role":"user","content":"Is this secure?"}'
		];

		for (const plaintext of testCases) {
			const ciphertext = encrypt(plaintext);
			expect(ciphertext).not.toBe(plaintext);
			expect(ciphertext.split(':').length).toBe(3);

			const decrypted = decrypt(ciphertext);
			expect(decrypted).toBe(plaintext);
		}
	});

	it('should return the original string if the format is invalid (fallback decrypt)', () => {
		const plaintext = 'Plain text with no colons';
		expect(decrypt(plaintext)).toBe(plaintext);

		const oneColon = 'part1:part2';
		expect(decrypt(oneColon)).toBe(oneColon);

		const invalidHexComponents = 'invalidivhex:invalidauthtag:invalidencrypted';
		expect(decrypt(invalidHexComponents)).toBe(invalidHexComponents);

		const invalidLengths = '1234:5678:abcd';
		expect(decrypt(invalidLengths)).toBe(invalidLengths);
	});

	it('should fail decryption if a wrong ENCRYPTION_KEY is used', () => {
		const plaintext = 'Super secret key test';

		// Encrypt with default/normal key
		const ciphertext = encrypt(plaintext);

		// Override to a different 32-byte key
		setTestKeyOverride('12345678901234567890123456789012');
		expect(() => decrypt(ciphertext)).toThrow();
	});

	it('should fail decryption if the auth tag is modified', () => {
		const plaintext = 'Tampered tag test';
		const ciphertext = encrypt(plaintext);

		const parts = ciphertext.split(':');
		expect(parts.length).toBe(3);

		// Flip the first character of the auth tag
		const originalTag = parts[1];
		const firstChar = originalTag[0];
		const newChar = firstChar === 'a' ? 'b' : 'a';
		parts[1] = newChar + originalTag.slice(1);

		const tamperedCiphertext = parts.join(':');
		expect(() => decrypt(tamperedCiphertext)).toThrow();
	});

	it('should fail decryption if the ciphertext is modified', () => {
		const plaintext = 'Tampered ciphertext test';
		const ciphertext = encrypt(plaintext);

		const parts = ciphertext.split(':');
		expect(parts.length).toBe(3);

		// Flip the first character of the ciphertext
		const originalCipher = parts[2];
		if (originalCipher.length > 0) {
			const firstChar = originalCipher[0];
			const newChar = firstChar === 'a' ? 'b' : 'a';
			parts[2] = newChar + originalCipher.slice(1);

			const tamperedCiphertext = parts.join(':');
			expect(() => decrypt(tamperedCiphertext)).toThrow();
		}
	});

	it('should throw an error if the ENCRYPTION_KEY is not defined or is of invalid length', () => {
		const plaintext = 'No key test';

		// Key not defined (represented as undefined in the override)
		setTestKeyOverride(undefined);
		expect(() => encrypt(plaintext)).toThrow();

		// Key not 32 bytes
		setTestKeyOverride('shortkey');
		expect(() => encrypt(plaintext)).toThrow();
	});
});
