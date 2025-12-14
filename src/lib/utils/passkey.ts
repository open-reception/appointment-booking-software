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
  enablePRF = false,
}: {
  id: string;
  challenge: string;
  email: string;
  enablePRF?: boolean;
}): {
  publicKey: PublicKeyCredentialCreationOptions;
} => {
  const options: {
    publicKey: PublicKeyCredentialCreationOptions;
  } = {
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

  // Enable PRF extension for zero-knowledge key derivation
  if (enablePRF) {
    options.publicKey.extensions = {
      prf: {},
    };
  }

  return options;
};

export type GeneratePasskeyResponse = {
  response: AuthenticatorAttestationResponse;
  id: string;
  getClientExtensionResults: () => { deviceName?: string; prf?: { enabled?: boolean } };
} | null;

export const generatePasskey = async ({
  id,
  challenge,
  email,
  enablePRF = false,
}: {
  id: string;
  challenge: string;
  email: string;
  enablePRF?: boolean;
}): Promise<GeneratePasskeyResponse> => {
  const options = getCredentialOptions({ id, challenge, email, enablePRF });
  return (await navigator.credentials.create(options)) as GeneratePasskeyResponse;
};

/**
 * Get PRF output from a passkey immediately after registration
 *
 * SECURITY: This must be called immediately after passkey creation to derive
 * the secret shard for zero-knowledge key splitting.
 *
 * MULTI-PASSKEY SUPPORT: Uses email as PRF salt so that all passkeys for the same user
 * can be used interchangeably. Each passkey will produce a different PRF output for
 * the same salt, allowing each to have its own database shard.
 *
 * @param passkeyId - The credential ID of the newly created passkey
 * @param rpId - Relying Party ID (domain)
 * @param challengeBase64 - Fresh challenge from server (base64url encoded)
 * @param email - User's email address (used as PRF salt for multi-passkey support)
 * @returns PRF output (32 bytes) or null if PRF is not supported
 * @throws Error if passkey doesn't support PRF or authentication fails
 */
export const getPRFOutputAfterRegistration = async ({
  passkeyId,
  rpId,
  challengeBase64,
  email,
}: {
  passkeyId: string;
  rpId: string;
  challengeBase64: string;
  email: string;
}): Promise<ArrayBuffer> => {
  // Prepare PRF salt (use email as deterministic salt for multi-passkey support)
  const prfSalt = new TextEncoder().encode(`open-reception-prf:${email}`);

  // Perform WebAuthn get() with PRF extension
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64UrlToArrayBuffer(challengeBase64),
      rpId: rpId,
      allowCredentials: [
        {
          id: base64UrlToArrayBuffer(passkeyId),
          type: "public-key",
        },
      ],
      userVerification: "required",
      extensions: {
        prf: {
          eval: {
            first: prfSalt,
          },
        },
      },
    },
  })) as PublicKeyCredential & {
    getClientExtensionResults: () => {
      prf?: {
        enabled?: boolean;
        results?: {
          first?: ArrayBuffer;
        };
      };
    };
  };

  if (!credential) {
    throw new Error("Failed to authenticate with new passkey");
  }

  // Extract PRF output
  const extensionResults = credential.getClientExtensionResults();
  const prfResults = extensionResults.prf;

  if (!prfResults || !prfResults.results || !prfResults.results.first) {
    throw new Error(
      "PRF extension not supported by this passkey. " +
        "Please use a modern authenticator (YubiKey 5.2.3+, Titan Gen2, Windows Hello, Touch ID, or Android)",
    );
  }

  // PRF output is BufferSource, ensure we return ArrayBuffer
  const prfOutput = prfResults.results.first;
  if (prfOutput instanceof ArrayBuffer) {
    return prfOutput;
  } else {
    // Convert ArrayBufferView to ArrayBuffer
    return prfOutput.buffer.slice(prfOutput.byteOffset, prfOutput.byteOffset + prfOutput.byteLength);
  }
};

export type GetCredentialResponse = PublicKeyCredential & {
  prfOutput?: ArrayBuffer; // PRF output if enablePRF was true
};

export const getCredential = async ({
  id,
  challenge,
  email,
  enablePRF = false,
}: {
  id: string;
  challenge: string;
  email: string;
  enablePRF?: boolean;
}): Promise<GetCredentialResponse> => {
  // Build WebAuthn options manually to support PRF
  const challengeBuffer = base64UrlToArrayBuffer(challenge);

  const publicKeyOptions: PublicKeyCredentialRequestOptions = {
    challenge: challengeBuffer,
    rpId: id,
    userVerification: "preferred",
  };

  // Add PRF extension if enabled
  // MULTI-PASSKEY SUPPORT: Use email as salt so all passkeys for the same user work
  if (enablePRF) {
    const prfSalt = new TextEncoder().encode(`open-reception-prf:${email}`);
    publicKeyOptions.extensions = {
      prf: {
        eval: {
          first: prfSalt,
        },
      },
    };
  }

  const credential = (await navigator.credentials.get({
    publicKey: publicKeyOptions,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error("Failed to get credential");
  }

  let prfOutput: ArrayBuffer | undefined;

  // Extract PRF output if it was enabled
  if (enablePRF) {
    const extensionResults = credential.getClientExtensionResults() as {
      prf?: {
        enabled?: boolean;
        results?: {
          first?: BufferSource;
        };
      };
    };

    if (extensionResults.prf?.results?.first) {
      const prfResult = extensionResults.prf.results.first;
      // Convert BufferSource to ArrayBuffer
      if (prfResult instanceof ArrayBuffer) {
        prfOutput = prfResult;
      } else {
        prfOutput = prfResult.buffer.slice(
          prfResult.byteOffset,
          prfResult.byteOffset + prfResult.byteLength
        );
      }
    }
  }

  // Return credential with optional prfOutput attached
  return Object.assign(credential, { prfOutput }) as GetCredentialResponse;
};

export const getCounterFromAuthenticatorData = (authenticatorData: ArrayBuffer) => {
  const view = new DataView(authenticatorData);
  // Counter is at offset 33, 4 bytes, big-endian
  return view.getUint32(33, false); // false = big-endian
};
