import { Patient } from '$lib/models/Patient';
import { Appointment } from '$lib/models/Appointment';
import { KyberCrypto } from '$lib/crypto/crypto-utils';
import { OptimizedArgon2 } from '$lib/crypto/optimized-argon2';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
	const serverImplementation = await OptimizedArgon2.getImplementationInfo();
	
	return {
		serverImplementation
	};
};

export const actions: Actions = {
	serverTest: async ({ request }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		const pin = data.get('pin') as string;

		const results: { step: string; time: number; details?: any }[] = [];

		try {
			const startTime = performance.now();
			
			// Patient Registration
			const patient = await Patient.create(email);
			const regStart = performance.now();
			await patient.generateKeyPair(pin, { memoryCost: 65536, timeCost: 10 });
			const regEnd = performance.now();
			
			results.push({
				step: 'Patient Registration',
				time: regEnd - regStart,
				details: patient.performanceInfo
			});

			// Practice Keys
			const practiceStart = performance.now();
			const practiceKeys = KyberCrypto.generateKeyPair();
			const practiceEnd = performance.now();
			
			results.push({
				step: 'Practice Key Generation',
				time: practiceEnd - practiceStart
			});

			// Create and Encrypt Appointment
			const appointment = new Appointment(
				Appointment.generateId(),
				new Date(),
				{
					patientName: 'Test Patient',
					patientEmail: email,
					reason: 'Performance Test',
					notes: 'Server-side performance test',
					duration: 30
				}
			);

			const recipientKeys = new Map();
			recipientKeys.set('doctor', practiceKeys.publicKey);
			recipientKeys.set(patient.patientId, patient.keyPair!.publicKey);

			const encStart = performance.now();
			const encryptedAppointment = await appointment.encrypt(recipientKeys);
			const encEnd = performance.now();
			
			results.push({
				step: 'Appointment Encryption',
				time: encEnd - encStart
			});

			// Key Reconstruction
			const recStart = performance.now();
			const reconstructedKey = await patient.reconstructPrivateKey(pin, patient.serverShare, { memoryCost: 65536, timeCost: 10 });
			const recEnd = performance.now();
			
			results.push({
				step: 'Key Reconstruction',
				time: recEnd - recStart
			});

			// Decrypt Appointment
			const decStart = performance.now();
			await Appointment.decrypt(
				encryptedAppointment,
				patient.patientId,
				reconstructedKey
			);
			const decEnd = performance.now();
			
			results.push({
				step: 'Appointment Decryption',
				time: decEnd - decStart
			});

			const totalTime = performance.now() - startTime;
			results.push({
				step: 'Total Time',
				time: totalTime
			});

			return {
				success: true,
				results,
				implementation: await OptimizedArgon2.getImplementationInfo(),
				environment: 'Server-Side (SSR)'
			};

		} catch (error) {
			return {
				success: false,
				error: String(error),
				environment: 'Server-Side (SSR)'
			};
		}
	}
};