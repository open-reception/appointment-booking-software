export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
	const bytes = new Uint8Array(buffer);
	let binary = "";

	// Simple loop, no fancy operations
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}

	return window.btoa(binary);
};

function base64ToArrayBuffer(base64: string) {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

export const fetchChallenge = async (email: string) => {
	const resp = await fetch("/api/auth/challenge", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ email })
	});

	try {
		const data = await resp.json();
		return {
			id: data.rpId,
			challenge: data.challenge
		};
	} catch {
		return null;
	}
};

export const generatePasskey = async ({
	id,
	challenge,
	email
}: {
	id: string;
	challenge: string;
	email: string;
}): Promise<{
	response: AuthenticatorAttestationResponse;
	id: string;
	getClientExtensionResults: () => { deviceName?: string };
} | null> => {
	const publicKey: PublicKeyCredentialCreationOptions = {
		challenge: base64ToArrayBuffer(challenge),
		rp: {
			id,
			name: "Open Reception"
		},
		user: {
			id: new Uint8Array(16),
			name: email,
			displayName: email
		},
		pubKeyCredParams: [
			{ alg: -7, type: "public-key" } // ES256
		]
	};
	return (await navigator.credentials.create({ publicKey })) as {
		response: AuthenticatorAttestationResponse;
		id: string;
		getClientExtensionResults: () => { deviceName?: string };
	} | null;
};
