import logger from "$lib/logger";

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  try {
    const bytes = new Uint8Array(buffer);
    let binary = "";

    // Simple loop, no fancy operations
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
  } catch (error) {
    logger.error("Failed to convert ArrayBuffer to Base64", {
      error,
      notes:
        "If you see this error locally, the best way to use passkeys is Chromium as of writing this",
    });
    throw error;
  }
};

export const base64UrlToArrayBuffer = (base64url: string) => {
  // Replace URL-safe characters and add padding
  const base64 = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");

  return base64ToArrayBuffer(base64);
};

export function base64ToArrayBuffer(base64: string) {
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  try {
    const data = await resp.json();
    return {
      id: data.rpId,
      challenge: data.challenge,
    };
  } catch {
    logger.error("Failed to fetch challenge", { email, status: resp.status });
    return null;
  }
};

export const getCredentialOptions = ({
  id,
  challenge,
  email,
}: {
  id: string;
  challenge: string;
  email: string;
}): {
  publicKey: PublicKeyCredentialCreationOptions;
} => {
  return {
    publicKey: {
      challenge: base64UrlToArrayBuffer(challenge),
      rp: {
        id,
        name: "Open Reception",
      },
      user: {
        id: new Uint8Array(16),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
      ],
    },
  };
};

export type GeneratePasskeyResponse = {
  response: AuthenticatorAttestationResponse;
  id: string;
  getClientExtensionResults: () => { deviceName?: string };
} | null;
export const generatePasskey = async ({
  id,
  challenge,
  email,
}: {
  id: string;
  challenge: string;
  email: string;
}): Promise<GeneratePasskeyResponse> => {
  const options = getCredentialOptions({ id, challenge, email });
  return (await navigator.credentials.create(options)) as GeneratePasskeyResponse;
};

export type GetCredentialResponse = PublicKeyCredential & {
  response: PublicKeyCredential;
  id: string;
};
export const getCredential = async ({
  id,
  challenge,
  email,
}: {
  id: string;
  challenge: string;
  email: string;
}) => {
  const options = getCredentialOptions({ id, challenge, email });
  return (await navigator.credentials.get(options)) as GetCredentialResponse;
};

export const getCounterFromAuthenticatorData = (authenticatorData: ArrayBuffer) => {
  const view = new DataView(authenticatorData);
  // Counter is at offset 33, 4 bytes, big-endian
  return view.getUint32(33, false); // false = big-endian
};
