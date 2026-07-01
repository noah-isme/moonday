interface RateLimitRecord {
	count: number;
	resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
	limit: number; // Max number of requests allowed in the window
	windowMs: number; // Time window in milliseconds
}

/**
 * Checks if a client identifier has exceeded the rate limit.
 * Returns details about the rate limit status.
 */
export function checkRateLimit(
	identifier: string,
	options: RateLimitOptions
): {
	success: boolean;
	limit: number;
	remaining: number;
	resetTime: number;
} {
	const now = Date.now();
	let record = rateLimitStore.get(identifier);

	if (!record || now > record.resetTime) {
		record = {
			count: 0,
			resetTime: now + options.windowMs
		};
	}

	record.count++;
	rateLimitStore.set(identifier, record);

	const remaining = Math.max(0, options.limit - record.count);
	const success = record.count <= options.limit;

	return {
		success,
		limit: options.limit,
		remaining,
		resetTime: record.resetTime
	};
}
