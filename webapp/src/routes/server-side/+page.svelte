<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	export let data: PageData;
	export let form: ActionData;

	let isLoading = false;
</script>

<svelte:head>
	<title>Server-Side Test - Open Reception</title>
</svelte:head>

<div class="container">
	<h1>Server-Side Encryption Test</h1>
	
	<div class="card">
		<h2>Test Parameters</h2>
		<form 
			method="POST" 
			action="?/test"
			use:enhance={() => {
				isLoading = true;
				return async ({ update }) => {
					await update();
					isLoading = false;
				};
			}}
		>
			<div class="form-group">
				<label for="email">Patient Email:</label>
				<input 
					id="email" 
					name="email" 
					type="email" 
					value="test.patient@example.com"
					disabled={isLoading} 
					required 
				/>
			</div>
			
			<div class="form-group">
				<label for="pin">PIN:</label>
				<input 
					id="pin" 
					name="pin" 
					type="password" 
					value="1234"
					disabled={isLoading} 
					required 
				/>
			</div>
			
			<div class="form-group">
				<label for="patientName">Patient Name:</label>
				<input 
					id="patientName" 
					name="patientName" 
					value="John Doe"
					disabled={isLoading} 
					required 
				/>
			</div>
			
			<div class="form-group">
				<label for="appointmentReason">Appointment Reason:</label>
				<input 
					id="appointmentReason" 
					name="appointmentReason" 
					value="Routine Checkup"
					disabled={isLoading} 
					required 
				/>
			</div>
			
			<div class="form-group">
				<label for="appointmentNotes">Notes:</label>
				<input 
					id="appointmentNotes" 
					name="appointmentNotes" 
					value="Annual health screening"
					disabled={isLoading} 
				/>
			</div>

			<div class="actions">
				<button type="submit" disabled={isLoading}>
					{isLoading ? 'Testing...' : 'Run Server-Side Test'}
				</button>
			</div>
		</form>
	</div>

	<div class="card">
		<h2>Current Implementation</h2>
		<div class="result">
			<strong>Environment:</strong> Node.js Server (Server-Side)<br>
			<strong>Argon2:</strong> {data.implementation}<br>
			<strong>Kyber:</strong> @noble/post-quantum ML-KEM 768<br>
			<strong>AES:</strong> Node.js crypto module<br>
			<strong>Rendering:</strong> Server-Side Rendering (SSR)<br>
			<strong>Parameters:</strong> Production settings (64MB, 10 iterations)
		</div>
	</div>

	{#if form?.results}
		<div class="card">
			<h2>Test Results</h2>
			<div class="result {form.success ? '' : 'error'}">
				{#each form.results as result}
					<div>{result}</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if form?.performanceResults && form.performanceResults.length > 0}
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
					{#each form.performanceResults as perf}
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

	{#if form?.patient}
		<div class="card">
			<h2>Generated Patient Data</h2>
			<div class="result">
				<strong>Patient ID:</strong> {form.patient.patientId.substring(0, 32)}...<br>
				<strong>Email:</strong> {form.patient.email}<br>
				<strong>Public Key Length:</strong> {form.patient.publicKey.length} bytes<br>
				<strong>Server Share X:</strong> {form.patient.serverShare.x}<br>
				<strong>Browser Share Available:</strong> {form.patient.browserShare ? 'Yes' : 'No'}<br>
				{#if form.patient.performanceInfo}
					<strong>Implementation:</strong> {form.patient.performanceInfo.argon2Implementation}
				{/if}
			</div>
		</div>
	{/if}

	{#if form?.error}
		<div class="card">
			<h2>Error</h2>
			<div class="result error">
				{form.error}
			</div>
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