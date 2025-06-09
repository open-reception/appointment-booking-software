<script lang="ts">
	import { Patient } from '$lib/models/Patient';
	import { Appointment } from '$lib/models/Appointment';
	import { KyberCrypto } from '$lib/crypto/crypto-utils';
	import { OptimizedArgon2 } from '$lib/crypto/optimized-argon2';
	import { onMount } from 'svelte';

	let email = 'test.patient@open-reception.org';
	let pin = '123456';
	let patientName = 'Max Mustermann';
	let appointmentReason = 'Checkup';
	let appointmentNotes = 'Patient will provide additional notes from old doctor';
	
	let patient: Patient | null = null;
	let results: string[] = [];
	let performanceResults: any[] = [];
	let isLoading = false;
	let implementation = '';

	onMount(async () => {
		implementation = await OptimizedArgon2.getImplementationInfo();
	});

	function addResult(message: string, isError = false) {
		results = [...results, `${isError ? '[ERROR]' : '[SUCCESS]'} ${new Date().toLocaleTimeString()}: ${message}`];
	}

	function addPerformance(step: string, time: number, details?: any) {
		performanceResults = [...performanceResults, {
			step,
			time: time.toFixed(2),
			details: details || {}
		}];
	}

	async function runClientSideTest() {
		if (isLoading) return;
		
		isLoading = true;
		results = [];
		performanceResults = [];
		
		try {
			addResult('Starting Client-Side Encryption Test');
			addResult(`Using: ${implementation}`);

			// 1. Patient Registration
			addResult('1. Creating patient and generating keys...');
			const startTime = performance.now();
			
			patient = new Patient(email);
			const regStart = performance.now();
			await patient.generateKeyPair(pin, { memoryCost: 16384, timeCost: 3 });
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
			const reconstructedKey = await patient.reconstructPrivateKey(pin, patient.serverShare, { memoryCost: 16384, timeCost: 3 });
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
			addResult(`Client-side test completed successfully in ${totalTime.toFixed(2)}ms`);
			addPerformance('Total Time', totalTime);

		} catch (error) {
			addResult(`Error: ${error}`, true);
		} finally {
			isLoading = false;
		}
	}

	function clearResults() {
		results = [];
		performanceResults = [];
		patient = null;
	}
</script>

<svelte:head>
	<title>Client-Side Test - Open Reception</title>
</svelte:head>

<div class="container">
	<h1>Client-Side Encryption Test</h1>
	
	<div class="card">
		<h2>Test Parameters</h2>
		<div class="form-group">
			<label for="email">Patient Email:</label>
			<input id="email" bind:value={email} type="email" disabled={isLoading} />
		</div>
		
		<div class="form-group">
			<label for="pin">PIN:</label>
			<input id="pin" bind:value={pin} type="password" disabled={isLoading} />
		</div>
		
		<div class="form-group">
			<label for="patientName">Patient Name:</label>
			<input id="patientName" bind:value={patientName} disabled={isLoading} />
		</div>
		
		<div class="form-group">
			<label for="reason">Appointment Reason:</label>
			<input id="reason" bind:value={appointmentReason} disabled={isLoading} />
		</div>
		
		<div class="form-group">
			<label for="notes">Notes:</label>
			<input id="notes" bind:value={appointmentNotes} disabled={isLoading} />
		</div>

		<div class="actions">
			<button on:click={runClientSideTest} disabled={isLoading}>
				{isLoading ? 'Testing...' : 'Run Client-Side Test'}
			</button>
			<button on:click={clearResults} disabled={isLoading}>
				Clear Results
			</button>
		</div>
	</div>

	<div class="card">
		<h2>Current Implementation</h2>
		<div class="result">
			<strong>Environment:</strong> Browser (Client-Side)<br>
			<strong>Argon2:</strong> {implementation}<br>
			<strong>Kyber:</strong> @noble/post-quantum ML-KEM 768<br>
			<strong>AES:</strong> Web Crypto API<br>
			<strong>Rendering:</strong> Client-Side Rendering (CSR)
		</div>
	</div>

	{#if results.length > 0}
		<div class="card">
			<h2>Test Results</h2>
			<div class="result">
				{#each results as result}
					<div>{result}</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if performanceResults.length > 0}
		<div class="card">
			<h2>Performance Metrics</h2>
			<table>
				<thead>
					<tr>
						<th>Step</th>
						<th>Time (ms)</th>
						<th>Details</th>
					</tr>
				</thead>
				<tbody>
					{#each performanceResults as perf}
						<tr>
							<td>{perf.step}</td>
							<td>{perf.time}</td>
							<td>
								{#if perf.details.argon2Implementation}
									Argon2: {perf.details.argon2Implementation}<br>
								{/if}
								{#if perf.details.keyGenTime}
									Kyber: {perf.details.keyGenTime.toFixed(2)}ms<br>
								{/if}
								{#if perf.details.shamirSplitTime}
									Shamir: {perf.details.shamirSplitTime.toFixed(2)}ms
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1000px;
		margin: 0 auto;
	}

	.form-group {
		margin: 1rem 0;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.form-group label {
		min-width: 150px;
		text-align: right;
		font-weight: bold;
	}

	.form-group input {
		flex: 1;
		max-width: 300px;
	}

	.actions {
		margin: 2rem 0;
		text-align: center;
	}

	table {
		font-size: 0.9rem;
	}

	.result div {
		margin: 0.2rem 0;
	}
</style>