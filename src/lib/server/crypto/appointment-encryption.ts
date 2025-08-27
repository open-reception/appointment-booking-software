import logger from "$lib/logger";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * Appointment data structure for encryption
 */
export interface AppointmentData {
	title: string;
	description?: string;
	clientEmail: string;
}

/**
 * Encrypted appointment data with key shares
 */
export interface EncryptedAppointmentData {
	encryptedData: string;
	clientKeyShare: string;
	staffKeyShares: Array<{
		staffId: string;
		encryptedKey: string;
	}>;
}

/**
 * Service for hybrid encryption of appointment data
 * Uses symmetric encryption (AES-256-GCM) for data and asymmetric for key sharing
 */
export class AppointmentEncryptionService {
	private static readonly ALGORITHM = 'aes-256-gcm';
	private static readonly KEY_LENGTH = 32; // 256 bits
	private static readonly IV_LENGTH = 16; // 128 bits

	/**
	 * Encrypt appointment data using hybrid encryption
	 * @param data Appointment data to encrypt
	 * @param clientPublicKey Client's public key for key encryption
	 * @param staffPublicKeys Array of staff public keys
	 * @returns Encrypted data with key shares
	 */
	static async encryptAppointmentData(
		data: AppointmentData,
		clientPublicKey: string,
		staffPublicKeys: Array<{ staffId: string; publicKey: string }>
	): Promise<EncryptedAppointmentData> {
		const log = logger.setContext("AppointmentEncryption");
		
		try {
			// Generate symmetric key for data encryption
			const symmetricKey = randomBytes(this.KEY_LENGTH);
			const iv = randomBytes(this.IV_LENGTH);

			// Encrypt the appointment data with symmetric key
			const cipher = createCipheriv(this.ALGORITHM, symmetricKey, iv);
			const dataString = JSON.stringify(data);
			
			let encrypted = cipher.update(dataString, 'utf8', 'base64');
			encrypted += cipher.final('base64');
			
			const authTag = cipher.getAuthTag();
			
			// Combine IV, auth tag, and encrypted data
			const encryptedData = Buffer.concat([
				iv,
				authTag,
				Buffer.from(encrypted, 'base64')
			]).toString('base64');

			// TODO: Encrypt symmetric key for client using Kyber + client's key
			// For now, we'll store it as base64 (this needs proper implementation)
			const clientKeyShare = Buffer.concat([
				Buffer.from('CLIENT_KEY_PLACEHOLDER:', 'utf8'),
				symmetricKey
			]).toString('base64');

			// TODO: Encrypt symmetric key for each staff member
			const staffKeyShares = staffPublicKeys.map(({ staffId, publicKey }) => ({
				staffId,
				encryptedKey: Buffer.concat([
					Buffer.from(`STAFF_KEY_PLACEHOLDER_${staffId}:`, 'utf8'),
					symmetricKey
				]).toString('base64')
			}));

			log.debug("Appointment data encrypted successfully", {
				dataSize: dataString.length,
				clientKeyShareLength: clientKeyShare.length,
				staffKeySharesCount: staffKeyShares.length
			});

			return {
				encryptedData,
				clientKeyShare,
				staffKeyShares
			};

		} catch (error) {
			log.error("Failed to encrypt appointment data", { error: String(error) });
			throw new Error("Encryption failed");
		}
	}

	/**
	 * Decrypt appointment data using client's key
	 * @param encryptedData Base64 encoded encrypted data
	 * @param clientKeyShare Encrypted symmetric key for client
	 * @param clientPrivateKeyShare Client's private key share
	 * @param clientPin Client's PIN
	 * @returns Decrypted appointment data
	 */
	static async decryptAppointmentDataForClient(
		encryptedData: string,
		clientKeyShare: string,
		clientPrivateKeyShare: string,
		clientPin: string
	): Promise<AppointmentData> {
		const log = logger.setContext("AppointmentEncryption");
		
		try {
			// TODO: Reconstruct client's private key from PIN and private key share
			// TODO: Decrypt the symmetric key using Kyber + client's private key
			
			// For now, extract the symmetric key from the placeholder
			const keyShareBuffer = Buffer.from(clientKeyShare, 'base64');
			const prefixLength = 'CLIENT_KEY_PLACEHOLDER:'.length;
			const symmetricKey = keyShareBuffer.subarray(prefixLength);

			// Decrypt the data
			const combinedBuffer = Buffer.from(encryptedData, 'base64');
			const iv = combinedBuffer.subarray(0, this.IV_LENGTH);
			const authTag = combinedBuffer.subarray(this.IV_LENGTH, this.IV_LENGTH + 16);
			const encrypted = combinedBuffer.subarray(this.IV_LENGTH + 16);

			const decipher = createDecipheriv(this.ALGORITHM, symmetricKey, iv);
			decipher.setAuthTag(authTag);
			
			let decrypted = decipher.update(encrypted, undefined, 'utf8');
			decrypted += decipher.final('utf8');

			const data = JSON.parse(decrypted) as AppointmentData;

			log.debug("Appointment data decrypted successfully for client", {
				dataSize: decrypted.length
			});

			return data;

		} catch (error) {
			log.error("Failed to decrypt appointment data for client", { error: String(error) });
			throw new Error("Decryption failed - invalid credentials or corrupted data");
		}
	}

	/**
	 * Decrypt appointment data using staff member's key (client-side operation)
	 * This method is intended for documentation - actual decryption happens in frontend
	 * @param encryptedData Base64 encoded encrypted data
	 * @param staffKeyShare Staff's encrypted symmetric key from appointmentKeyShare table
	 * @param staffPrivateKey Staff member's private key (from client-side session)
	 * @returns Decrypted appointment data
	 */
	static async decryptAppointmentDataForStaff(
		encryptedData: string,
		staffKeyShare: string,
		staffPrivateKey: string
	): Promise<AppointmentData> {
		const log = logger.setContext("AppointmentEncryption");
		
		try {
			// TODO: Decrypt the symmetric key using staff's private key
			
			// For now, extract the symmetric key from the placeholder
			const keyBuffer = Buffer.from(staffKeyShare, 'base64');
			const colonIndex = keyBuffer.indexOf(':');
			const symmetricKey = keyBuffer.subarray(colonIndex + 1);

			// Decrypt the data (same process as client)
			const combinedBuffer = Buffer.from(encryptedData, 'base64');
			const iv = combinedBuffer.subarray(0, this.IV_LENGTH);
			const authTag = combinedBuffer.subarray(this.IV_LENGTH, this.IV_LENGTH + 16);
			const encrypted = combinedBuffer.subarray(this.IV_LENGTH + 16);

			const decipher = createDecipheriv(this.ALGORITHM, symmetricKey, iv);
			decipher.setAuthTag(authTag);
			
			let decrypted = decipher.update(encrypted, undefined, 'utf8');
			decrypted += decipher.final('utf8');

			const data = JSON.parse(decrypted) as AppointmentData;

			log.debug("Appointment data decrypted successfully for staff", {
				dataSize: decrypted.length
			});

			return data;

		} catch (error) {
			log.error("Failed to decrypt appointment data for staff", { error: String(error) });
			throw new Error("Decryption failed - invalid credentials or corrupted data");
		}
	}

	/**
	 * Verify client PIN by attempting to decrypt a test payload
	 * @param clientPrivateKeyShare Client's private key share from database
	 * @param clientPin Client's PIN
	 * @param clientPublicKey Client's public key for verification
	 * @returns True if PIN is valid
	 */
	static async verifyClientPin(
		clientPrivateKeyShare: string,
		clientPin: string,
		clientPublicKey: string
	): Promise<boolean> {
		const log = logger.setContext("AppointmentEncryption");
		
		try {
			// TODO: Implement PIN verification using cryptographic methods
			// This should reconstruct the private key from PIN + privateKeyShare
			// and verify it matches the public key
			
			// For now, always return true (needs proper implementation)
			log.debug("Client PIN verification attempted", {
				hasPrivateKeyShare: !!clientPrivateKeyShare,
				hasPin: !!clientPin,
				hasPublicKey: !!clientPublicKey
			});
			
			return true;

		} catch (error) {
			log.error("Failed to verify client PIN", { error: String(error) });
			return false;
		}
	}
}