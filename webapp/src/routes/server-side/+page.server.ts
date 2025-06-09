import { Patient } from '$lib/models/Patient';
import { Appointment } from '$lib/models/Appointment';
import { KyberCrypto } from '$lib/crypto/crypto-utils';
import { OptimizedArgon2 } from '$lib/crypto/optimized-argon2';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
	const implementation = await OptimizedArgon2.getImplementationInfo();
	
	return {
		implementation
	};
};

export const actions: Actions = {
	test: async ({ request }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		const pin = data.get('pin') as string;
		const patientName = data.get('patientName') as string;
		const appointmentReason = data.get('appointmentReason') as string;
		const appointmentNotes = data.get('appointmentNotes') as string;

		const results: string[] = [];
		const performanceResults: any[] = [];

		function addResult(message: string, isError = false) {
			results.push(`${isError ? '[ERROR]' : '[SUCCESS]'} ${new Date().toLocaleTimeString()}: ${message}`);
		}

		function addPerformance(step: string, time: number, details?: any) {
			performanceResults.push({
				step,
				time: time.toFixed(2),
				details: details || {}
			});
		}

		try {
			addResult('Starting Server-Side Encryption Test');
			addResult(`Using: ${await OptimizedArgon2.getImplementationInfo()}`);

			// 1. Patient Registration
			addResult('1. Creating patient and generating keys...');
			const startTime = performance.now();
			
			const patient = await Patient.create(email);
			const regStart = performance.now();
			await patient.generateKeyPair(pin, { memoryCost: 65536, timeCost: 10 });
			const regEnd = performance.now();
			
			addResult(`Patient registered with ID: ${patient.patientId.substring(0, 16)}...`);
			addPerformance('Patient Registration', regEnd - regStart, patient.performanceInfo);

			// 2. Practice Keys
			addResult('2. Generating practice keys...');
			const practiceStart = performance.now();
			const practiceKeys = KyberCrypto.generateKeyPair();
			const practiceEnd = performance.now();
			
			addResult('Practice Kyber keys generated');
			addPerformance('Practice Key Generation', practiceEnd - practiceStart);

			// 3. Create and Encrypt Appointment
			addResult('3. Creating and encrypting appointment...');
			const appointment = new Appointment(
				Appointment.generateId(),
				new Date(),
				{
					patientName,
					patientEmail: email,
					reason: appointmentReason,
					notes: appointmentNotes,
					duration: 30
				}
			);

			const recipientKeys = new Map();
			recipientKeys.set('doctor', practiceKeys.publicKey);
			recipientKeys.set(patient.patientId, patient.keyPair!.publicKey);

			const encStart = performance.now();
			const encryptedAppointment = await appointment.encrypt(recipientKeys);
			const encEnd = performance.now();
			
			addResult(`Appointment encrypted for 2 recipients`);
			addPerformance('Appointment Encryption', encEnd - encStart);

			// 4. Key Reconstruction
			addResult('4. Reconstructing patient private key...');
			const recStart = performance.now();
			const reconstructedKey = await patient.reconstructPrivateKey(pin, patient.serverShare, { memoryCost: 65536, timeCost: 10 });
			const recEnd = performance.now();
			
			addResult('Private key successfully reconstructed');
			addPerformance('Key Reconstruction', recEnd - recStart);

			// 5. Decrypt Appointment
			addResult('5. Decrypting appointment...');
			const decStart = performance.now();
			const decryptedAppointment = await Appointment.decrypt(
				encryptedAppointment,
				patient.patientId,
				reconstructedKey
			);
			const decEnd = performance.now();
			
			addResult(`Decrypted appointment: ${decryptedAppointment.details.reason}`);
			addPerformance('Appointment Decryption', decEnd - decStart);

			const totalTime = performance.now() - startTime;
			addResult(`Server-side test completed successfully in ${totalTime.toFixed(2)}ms`);
			addPerformance('Total Time', totalTime);

			return {
				success: true,
				results,
				performanceResults,
				patient: patient.toJSON()
			};

		} catch (error) {
			addResult(`Error: ${error}`, true);
			return {
				success: false,
				results,
				performanceResults: [],
				error: String(error)
			};
		}
	}
};