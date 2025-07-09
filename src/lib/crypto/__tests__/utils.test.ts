import { describe, it, expect, beforeEach } from "vitest";
import { BufferUtils, KyberCrypto, AESCrypto, ShamirSecretSharing } from "../utils";
import type { CryptoBuffer, KyberKeyPair, ShamirShare } from "../utils";

describe("BufferUtils", () => {
	describe("from()", () => {
		it("should convert string to CryptoBuffer with utf8 encoding", () => {
			const input = "Hello World";
			const result = BufferUtils.from(input);
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result).toEqual(new TextEncoder().encode(input));
		});

		it("should convert hex string to CryptoBuffer", () => {
			const input = "48656c6c6f";
			const result = BufferUtils.from(input, "hex");
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
		});

		it("should convert number array to CryptoBuffer", () => {
			const input = [72, 101, 108, 108, 111];
			const result = BufferUtils.from(input);
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result).toEqual(new Uint8Array(input));
		});

		it("should convert ArrayBuffer to CryptoBuffer", () => {
			const input = new ArrayBuffer(5);
			const view = new Uint8Array(input);
			view.set([72, 101, 108, 108, 111]);
			const result = BufferUtils.from(input);
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
		});

		it("should handle empty hex string", () => {
			const result = BufferUtils.from("", "hex");
			expect(result).toEqual(new Uint8Array([]));
		});

		it("should handle invalid hex string", () => {
			const result = BufferUtils.from("invalid", "hex");
			// Invalid hex characters will be parsed as NaN, resulting in non-empty array
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("toString()", () => {
		it("should convert CryptoBuffer to utf8 string", () => {
			const input = new Uint8Array([72, 101, 108, 108, 111]);
			const result = BufferUtils.toString(input);
			expect(result).toBe("Hello");
		});

		it("should convert CryptoBuffer to hex string", () => {
			const input = new Uint8Array([72, 101, 108, 108, 111]);
			const result = BufferUtils.toString(input, "hex");
			expect(result).toBe("48656c6c6f");
		});

		it("should handle empty buffer", () => {
			const input = new Uint8Array([]);
			expect(BufferUtils.toString(input)).toBe("");
			expect(BufferUtils.toString(input, "hex")).toBe("");
		});

		it("should pad single digit hex values", () => {
			const input = new Uint8Array([0, 15, 255]);
			const result = BufferUtils.toString(input, "hex");
			expect(result).toBe("000fff");
		});
	});

	describe("concat()", () => {
		it("should concatenate multiple buffers", () => {
			const buf1 = new Uint8Array([1, 2, 3]);
			const buf2 = new Uint8Array([4, 5]);
			const buf3 = new Uint8Array([6, 7, 8, 9]);
			const result = BufferUtils.concat([buf1, buf2, buf3]);
			expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
		});

		it("should handle empty buffers", () => {
			const buf1 = new Uint8Array([1, 2]);
			const buf2 = new Uint8Array([]);
			const buf3 = new Uint8Array([3, 4]);
			const result = BufferUtils.concat([buf1, buf2, buf3]);
			expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
		});

		it("should handle single buffer", () => {
			const buf = new Uint8Array([1, 2, 3]);
			const result = BufferUtils.concat([buf]);
			expect(result).toEqual(buf);
		});

		it("should handle empty array", () => {
			const result = BufferUtils.concat([]);
			expect(result).toEqual(new Uint8Array([]));
		});
	});

	describe("randomBytes()", () => {
		it("should generate random bytes of specified length", () => {
			const length = 32;
			const result = BufferUtils.randomBytes(length);
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result.length).toBe(length);
		});

		it("should generate different random bytes on each call", () => {
			const result1 = BufferUtils.randomBytes(16);
			const result2 = BufferUtils.randomBytes(16);
			expect(result1).not.toEqual(result2);
		});

		it("should handle zero length", () => {
			const result = BufferUtils.randomBytes(0);
			expect(result).toEqual(new Uint8Array([]));
		});
	});

	describe("xor()", () => {
		it("should perform XOR operation on equal length buffers", () => {
			const a = new Uint8Array([0xff, 0x00, 0xaa]);
			const b = new Uint8Array([0x00, 0xff, 0x55]);
			const result = BufferUtils.xor(a, b);
			expect(result).toEqual(new Uint8Array([0xff, 0xff, 0xff]));
		});

		it("should handle different length buffers", () => {
			const a = new Uint8Array([0xff, 0x00]);
			const b = new Uint8Array([0x00, 0xff, 0x55]);
			const result = BufferUtils.xor(a, b);
			expect(result).toEqual(new Uint8Array([0xff, 0xff, 0x55]));
		});

		it("should handle empty buffers", () => {
			const a = new Uint8Array([]);
			const b = new Uint8Array([1, 2, 3]);
			const result = BufferUtils.xor(a, b);
			expect(result).toEqual(new Uint8Array([1, 2, 3]));
		});
	});

	describe("equals()", () => {
		it("should return true for equal buffers", () => {
			const a = new Uint8Array([1, 2, 3, 4]);
			const b = new Uint8Array([1, 2, 3, 4]);
			expect(BufferUtils.equals(a, b)).toBe(true);
		});

		it("should return false for different buffers", () => {
			const a = new Uint8Array([1, 2, 3, 4]);
			const b = new Uint8Array([1, 2, 3, 5]);
			expect(BufferUtils.equals(a, b)).toBe(false);
		});

		it("should return false for different length buffers", () => {
			const a = new Uint8Array([1, 2, 3]);
			const b = new Uint8Array([1, 2, 3, 4]);
			expect(BufferUtils.equals(a, b)).toBe(false);
		});

		it("should return true for empty buffers", () => {
			const a = new Uint8Array([]);
			const b = new Uint8Array([]);
			expect(BufferUtils.equals(a, b)).toBe(true);
		});
	});
});

describe("KyberCrypto", () => {
	let keyPair: KyberKeyPair;

	beforeEach(() => {
		keyPair = KyberCrypto.generateKeyPair();
	});

	describe("generateKeyPair()", () => {
		it("should generate a valid key pair", () => {
			expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.publicKey.length).toBeGreaterThan(0);
			expect(keyPair.privateKey.length).toBeGreaterThan(0);
		});

		it("should generate different key pairs on each call", () => {
			const keyPair2 = KyberCrypto.generateKeyPair();
			expect(keyPair.publicKey).not.toEqual(keyPair2.publicKey);
			expect(keyPair.privateKey).not.toEqual(keyPair2.privateKey);
		});
	});

	describe("encapsulate()", () => {
		it("should encapsulate a shared secret", () => {
			const result = KyberCrypto.encapsulate(keyPair.publicKey);
			expect(result.sharedSecret).toBeInstanceOf(Uint8Array);
			expect(result.encapsulatedSecret).toBeInstanceOf(Uint8Array);
			expect(result.sharedSecret.length).toBeGreaterThan(0);
			expect(result.encapsulatedSecret.length).toBeGreaterThan(0);
		});

		it("should generate different shared secrets on each call", () => {
			const result1 = KyberCrypto.encapsulate(keyPair.publicKey);
			const result2 = KyberCrypto.encapsulate(keyPair.publicKey);
			expect(result1.sharedSecret).not.toEqual(result2.sharedSecret);
			expect(result1.encapsulatedSecret).not.toEqual(result2.encapsulatedSecret);
		});
	});

	describe("decapsulate()", () => {
		it("should decapsulate the shared secret correctly", () => {
			const encapsulated = KyberCrypto.encapsulate(keyPair.publicKey);
			const decapsulated = KyberCrypto.decapsulate(
				keyPair.privateKey,
				encapsulated.encapsulatedSecret
			);
			expect(decapsulated).toEqual(encapsulated.sharedSecret);
		});

		it("should return different results for different private keys", () => {
			const keyPair2 = KyberCrypto.generateKeyPair();
			const encapsulated = KyberCrypto.encapsulate(keyPair.publicKey);
			const decapsulated1 = KyberCrypto.decapsulate(
				keyPair.privateKey,
				encapsulated.encapsulatedSecret
			);
			const decapsulated2 = KyberCrypto.decapsulate(
				keyPair2.privateKey,
				encapsulated.encapsulatedSecret
			);
			expect(decapsulated1).not.toEqual(decapsulated2);
		});
	});
});

describe("AESCrypto", () => {
	describe("generateSessionKey()", () => {
		it("should generate a 32-byte key", () => {
			const key = AESCrypto.generateSessionKey();
			expect(key).toBeInstanceOf(Uint8Array);
			expect(key.length).toBe(32);
		});

		it("should generate different keys on each call", () => {
			const key1 = AESCrypto.generateSessionKey();
			const key2 = AESCrypto.generateSessionKey();
			expect(key1).not.toEqual(key2);
		});
	});

	describe("encrypt() and decrypt()", () => {
		let key: CryptoBuffer;

		beforeEach(() => {
			key = AESCrypto.generateSessionKey();
		});

		it("should encrypt and decrypt data correctly", async () => {
			const plaintext = "Hello, World!";
			const encrypted = await AESCrypto.encrypt(plaintext, key);

			expect(encrypted.encrypted).toBeInstanceOf(Uint8Array);
			expect(encrypted.iv).toBeInstanceOf(Uint8Array);
			expect(encrypted.tag).toBeInstanceOf(Uint8Array);
			expect(encrypted.iv.length).toBe(16);
			expect(encrypted.tag.length).toBe(16);

			const decrypted = await AESCrypto.decrypt(
				encrypted.encrypted,
				key,
				encrypted.iv,
				encrypted.tag
			);
			expect(decrypted).toBe(plaintext);
		});

		it("should handle empty string", async () => {
			const plaintext = "";
			const encrypted = await AESCrypto.encrypt(plaintext, key);
			const decrypted = await AESCrypto.decrypt(
				encrypted.encrypted,
				key,
				encrypted.iv,
				encrypted.tag
			);
			expect(decrypted).toBe(plaintext);
		});

		it("should handle unicode characters", async () => {
			const plaintext = "🔐 Verschlüsselter Text mit Umlauten: äöü";
			const encrypted = await AESCrypto.encrypt(plaintext, key);
			const decrypted = await AESCrypto.decrypt(
				encrypted.encrypted,
				key,
				encrypted.iv,
				encrypted.tag
			);
			expect(decrypted).toBe(plaintext);
		});

		it("should generate different IV and tag for same plaintext", async () => {
			const plaintext = "Same text";
			const encrypted1 = await AESCrypto.encrypt(plaintext, key);
			const encrypted2 = await AESCrypto.encrypt(plaintext, key);

			expect(encrypted1.iv).not.toEqual(encrypted2.iv);
			expect(encrypted1.encrypted).not.toEqual(encrypted2.encrypted);
			expect(encrypted1.tag).not.toEqual(encrypted2.tag);
		});

		it("should fail with wrong key", async () => {
			const plaintext = "Secret message";
			const wrongKey = AESCrypto.generateSessionKey();
			const encrypted = await AESCrypto.encrypt(plaintext, key);

			await expect(
				AESCrypto.decrypt(encrypted.encrypted, wrongKey, encrypted.iv, encrypted.tag)
			).rejects.toThrow();
		});

		it("should fail with wrong IV", async () => {
			const plaintext = "Secret message";
			const wrongIV = BufferUtils.randomBytes(16);
			const encrypted = await AESCrypto.encrypt(plaintext, key);

			await expect(
				AESCrypto.decrypt(encrypted.encrypted, key, wrongIV, encrypted.tag)
			).rejects.toThrow();
		});

		it("should fail with wrong tag", async () => {
			const plaintext = "Secret message";
			const wrongTag = BufferUtils.randomBytes(16);
			const encrypted = await AESCrypto.encrypt(plaintext, key);

			await expect(
				AESCrypto.decrypt(encrypted.encrypted, key, encrypted.iv, wrongTag)
			).rejects.toThrow();
		});
	});
});

describe("ShamirSecretSharing", () => {
	describe("splitSecret()", () => {
		it("should split secret into shares", () => {
			const secret = BufferUtils.from("test secret");
			const shares = ShamirSecretSharing.splitSecret(secret, 2, 3);

			expect(shares).toHaveLength(3);
			shares.forEach((share, index) => {
				expect(share.x).toBe(index + 1);
				expect(share.y).toBeInstanceOf(Uint8Array);
				expect(share.y.length).toBe(4 + secret.length); // 4 bytes for length + secret
			});
		});

		it("should throw error for empty secret", () => {
			const secret = new Uint8Array([]);
			expect(() => ShamirSecretSharing.splitSecret(secret, 2, 3)).toThrow(
				"Secret cannot be empty for Shamir secret sharing"
			);
		});

		it("should handle large secrets", () => {
			const secret = BufferUtils.randomBytes(1000);
			const shares = ShamirSecretSharing.splitSecret(secret, 3, 5);

			expect(shares).toHaveLength(5);
			shares.forEach((share) => {
				expect(share.y.length).toBe(4 + secret.length);
			});
		});
	});

	describe("reconstructSecret()", () => {
		it("should reconstruct secret from shares", () => {
			const originalSecret = BufferUtils.from("test secret for reconstruction");
			const shares = ShamirSecretSharing.splitSecret(originalSecret, 2, 5);

			// Use first 2 shares (minimum threshold)
			const reconstructed = ShamirSecretSharing.reconstructSecret(shares.slice(0, 2));
			expect(reconstructed).toEqual(originalSecret);
		});

		it("should reconstruct secret from any subset of shares", () => {
			const originalSecret = BufferUtils.from("another test secret");
			const shares = ShamirSecretSharing.splitSecret(originalSecret, 3, 5);

			// Test different combinations
			const reconstructed1 = ShamirSecretSharing.reconstructSecret(shares.slice(0, 3));
			const reconstructed2 = ShamirSecretSharing.reconstructSecret(shares.slice(1, 4));
			const reconstructed3 = ShamirSecretSharing.reconstructSecret(shares.slice(2, 5));

			expect(reconstructed1).toEqual(originalSecret);
			expect(reconstructed2).toEqual(originalSecret);
			expect(reconstructed3).toEqual(originalSecret);
		});

		it("should throw error with insufficient shares", () => {
			const shares: ShamirShare[] = [{ x: 1, y: new Uint8Array([1, 2, 3]) }];
			expect(() => ShamirSecretSharing.reconstructSecret(shares)).toThrow(
				"Need at least 2 shares to reconstruct the secret"
			);
		});

		it("should handle secrets with different lengths", () => {
			const secrets = [
				BufferUtils.from("short"),
				BufferUtils.from("medium length secret"),
				BufferUtils.randomBytes(100)
			];

			secrets.forEach((secret) => {
				const shares = ShamirSecretSharing.splitSecret(secret, 2, 3);
				const reconstructed = ShamirSecretSharing.reconstructSecret(shares.slice(0, 2));
				expect(reconstructed).toEqual(secret);
			});
		});
	});
});
