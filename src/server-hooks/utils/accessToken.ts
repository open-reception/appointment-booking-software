import type { RequestEvent } from "@sveltejs/kit";

const ACCESS_TOKEN_COOKIE_NAME = "access_token";
export const getAccessToken = (
	event: RequestEvent<Partial<Record<string, string>>, string | null>
): string | null => {
	let accessToken: string | null = null;

	// Get access token from cookie
	const accessTokenCookie = event.cookies.get(ACCESS_TOKEN_COOKIE_NAME);
	if (accessTokenCookie) {
		accessToken = accessTokenCookie;
	}

	// Fallback: check Authorization header
	if (!accessToken) {
		const authHeader = event.request.headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			accessToken = authHeader.substring(7);
		}
	}

	return accessToken;
};
