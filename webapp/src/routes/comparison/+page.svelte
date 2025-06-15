<script lang="ts">
	import { enhance } from '$app/forms';
	import { Patient } from '$lib/models/Patient';
	import { Appointment } from '$lib/models/Appointment';
	import { KyberCrypto } from '$lib/crypto/crypto-utils';
	import { OptimizedArgon2 } from '$lib/crypto/optimized-argon2';
	import { onMount } from 'svelte';
	import type { PageData, ActionData } from './$types';

	export let data: PageData;
	export let form: ActionData;

	let email = 'performance.test@example.com';
	let pin = '1234';
	
	let clientResults: { step: string; time: number; details?: any }[] = [];
	let serverResults: { step: string; time: number; details?: any }[] = [];
	let isClientTesting = false;
	let isServerTesting = false;
	let clientImplementation = '';

	onMount(async () => {
		clientImplementation = await OptimizedArgon2.getImplementationInfo();
	});

	// Update server results when form data changes
	$: if (form?.success && form.results) {
		serverResults = form.results;
	}

	async function runClientTest() {
		if (isClientTesting) return;
		
		isClientTesting = true;
		clientResults = [];
		
		try {
			const startTime = performance.now();
			
			// Patient Registration
			const patient = await Patient.create(email);
			const regStart = performance.now();
			await patient.generateKeyPair(pin, { memoryCost: 16384, timeCost: 3 });
			const regEnd = performance.now();
			
			clientResults.push({
				step: 'Patient Registration',
				time: regEnd - regStart,
				details: patient.performanceInfo
			});

			// Practice Keys
			const practiceStart = performance.now();
			const practiceKeys = KyberCrypto.generateKeyPair();
			const practiceEnd = performance.now();
			
			clientResults.push({
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
					notes: 'Client-side performance test',
					duration: 30
				}
			);

			const recipientKeys = new Map();
			recipientKeys.set('doctor', practiceKeys.publicKey);
			recipientKeys.set(patient.patientId, patient.keyPair!.publicKey);

			const encStart = performance.now();
			const encryptedAppointment = await appointment.encrypt(recipientKeys);
			const encEnd = performance.now();
			
			clientResults.push({
				step: 'Appointment Encryption',
				time: encEnd - encStart
			});

			// Key Reconstruction
			const recStart = performance.now();
			const reconstructedKey = await patient.reconstructPrivateKey(pin, patient.serverShare, { memoryCost: 16384, timeCost: 3 });
			const recEnd = performance.now();
			
			clientResults.push({
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
			
			clientResults.push({
				step: 'Appointment Decryption',
				time: decEnd - decStart
			});

			const totalTime = performance.now() - startTime;
			clientResults.push({
				step: 'Total Time',
				time: totalTime
			});

			// Force reactivity
			clientResults = [...clientResults];

		} catch (error) {
			console.error('Client test error:', error);
		} finally {
			isClientTesting = false;
		}
	}

	function clearResults() {
		clientResults = [];
		serverResults = [];
	}

	function getSpeedComparison(clientTime: number, serverTime: number): string {
		if (clientTime === 0 || serverTime === 0) return '';
		
		const ratio = serverTime / clientTime;
		if (ratio > 1.1) {
			return `Client ${ratio.toFixed(1)}x faster`;
		} else if (ratio < 0.9) {
			return `Server ${(1/ratio).toFixed(1)}x faster`;
		} else {
			return 'Similar performance';
		}
	}

	function getClientTime(step: string): number {
		const result = clientResults.find(r => r.step === step);
		return result ? result.time : 0;
	}

	function getServerTime(step: string): number {
		const result = serverResults.find(r => r.step === step);
		return result ? result.time : 0;
	}
</script>

<svelte:head>
	<title>Performance Comparison - Open Reception</title>
</svelte:head>

<div class="container">
	<h1>Performance Comparison</h1>
	
	<div class="card">
		<h2>Test Parameters</h2>
		<div class="form-group">
			<label for="email">Email:</label>
			<input id="email" bind:value={email} type="email" disabled={isClientTesting || isServerTesting} />
		</div>
		
		<div class="form-group">
			<label for="pin">PIN:</label>
			<input id="pin" bind:value={pin} type="password" disabled={isClientTesting || isServerTesting} />
		</div>

		<div class="actions">
			<button on:click={runClientTest} disabled={isClientTesting || isServerTesting}>
				{isClientTesting ? 'Testing Client...' : 'Test Client-Side'}
			</button>
			
			<form 
				method="POST" 
				action="?/serverTest"
				style="display: inline;"
				use:enhance={({ formData }) => {
					formData.set('email', email);
					formData.set('pin', pin);
					isServerTesting = true;
					return async ({ update }) => {
						await update();
						isServerTesting = false;
					};
				}}
			>
				<button type="submit" disabled={isClientTesting || isServerTesting}>
					{isServerTesting ? 'Testing Server...' : 'Test Server-Side'}
				</button>
			</form>
			
			<button on:click={clearResults} disabled={isClientTesting || isServerTesting}>
				Clear Results
			</button>
		</div>
	</div>

	<div class="comparison-grid">
		<div class="card">
			<h2>Client-Side (CSR)</h2>
			<div class="result">
				<strong>Environment:</strong> Browser<br>
				<strong>Argon2:</strong> {clientImplementation}<br>
				<strong>Parameters:</strong> Fast (16MB, 3 iterations)<br>
				<strong>Rendering:</strong> Client-Side Rendering
			</div>
		</div>

		<div class="card">
			<h2>Server-Side (SSR)</h2>
			<div class="result">
				<strong>Environment:</strong> Node.js<br>
				<strong>Argon2:</strong> {data.serverImplementation}<br>
				<strong>Parameters:</strong> Production (64MB, 10 iterations)<br>
				<strong>Rendering:</strong> Server-Side Rendering
			</div>
		</div>
	</div>

	{#if clientResults.length > 0 || serverResults.length > 0}
		<div class="card">
			<h2>Performance Comparison</h2>
			<table>
				<thead>
					<tr>
						<th>Step</th>
						<th>Client-Side (ms)</th>
						<th>Server-Side (ms)</th>
						<th>Comparison</th>
						<th>Details</th>
					</tr>
				</thead>
				<tbody>
					{#each ['Patient Registration', 'Practice Key Generation', 'Appointment Encryption', 'Key Reconstruction', 'Appointment Decryption', 'Total Time'] as step}
						{#if getClientTime(step) > 0 || getServerTime(step) > 0}
							{@const clientTime = getClientTime(step)}
							{@const serverTime = getServerTime(step)}
							<tr>
								<td><strong>{step}</strong></td>
								<td class:fastest={clientTime > 0 && serverTime > 0 && clientTime < serverTime}>
									{clientTime > 0 ? clientTime.toFixed(2) : '-'}
								</td>
								<td class:fastest={clientTime > 0 && serverTime > 0 && serverTime < clientTime}>
									{serverTime > 0 ? serverTime.toFixed(2) : '-'}
								</td>
								<td>
									{#if clientTime > 0 && serverTime > 0}
										{getSpeedComparison(clientTime, serverTime)}
									{:else}
										-
									{/if}
								</td>
								<td>
									{#if clientResults.find(r => r.step === step)?.details?.argon2Implementation || serverResults.find(r => r.step === step)?.details?.argon2Implementation}
										{@const clientResult = clientResults.find(r => r.step === step)}
										{@const serverResult = serverResults.find(r => r.step === step)}
										Client: {clientResult?.details?.argon2Implementation || 'N/A'}<br>
										Server: {serverResult?.details?.argon2Implementation || 'N/A'}
									{:else}
										Universal crypto functions
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if clientResults.length > 0 && serverResults.length > 0}
		<div class="card">
			<h2>Performance Analysis</h2>
			<div class="analysis">
				{#if true}
					{@const clientTotal = getClientTime('Total Time')}
					{@const serverTotal = getServerTime('Total Time')}
					{@const clientArgon2 = getClientTime('Patient Registration') + getClientTime('Key Reconstruction')}
					{@const serverArgon2 = getServerTime('Patient Registration') + getServerTime('Key Reconstruction')}
					
					<div class="metric">
						<strong>Overall Performance:</strong>
						{#if clientTotal && serverTotal}
							{getSpeedComparison(clientTotal, serverTotal)}
							(Client: {clientTotal.toFixed(2)}ms vs Server: {serverTotal.toFixed(2)}ms)
						{/if}
					</div>
					
					<div class="metric">
						<strong>Argon2 Impact:</strong>
						Client: {clientArgon2.toFixed(2)}ms ({((clientArgon2/clientTotal)*100).toFixed(1)}% of total)<br>
						Server: {serverArgon2.toFixed(2)}ms ({((serverArgon2/serverTotal)*100).toFixed(1)}% of total)
					</div>
				{/if}
				
				<div class="metric">
					<strong>Crypto Operations:</strong>
					Both variants use identical universal crypto libraries for Kyber, AES, and Shamir operations.
					Only Argon2 implementation differs between client and server.
				</div>
				
				<div class="metric">
					<strong>Security vs Performance:</strong>
					Server uses production-grade Argon2 parameters (64MB, 10 iterations) while client uses 
					faster parameters (16MB, 3 iterations) for better user experience.
				</div>
			</div>
		</div>
	{/if}

	{#if form && !form.success}
		<div class="card">
			<h2>Server Test Error</h2>
			<div class="result error">
				{form.error}
			</div>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.comparison-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		margin: 2rem 0;
	}

	.form-group {
		margin: 1rem 0;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.form-group label {
		min-width: 100px;
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
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	table {
		font-size: 0.9rem;
		width: 100%;
	}

	.fastest {
		background-color: #e7f7e7;
		font-weight: bold;
	}

	.analysis {
		text-align: left;
	}

	.metric {
		margin: 1.5rem 0;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 4px;
		border-left: 4px solid #007bff;
	}

	@media (max-width: 768px) {
		.comparison-grid {
			grid-template-columns: 1fr;
		}
		
		.actions {
			flex-direction: column;
			align-items: center;
		}
	}
</style>