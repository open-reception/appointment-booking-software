export const load = async (event) => {
	const fetchEnvOk = async () => {
		const response = await event.fetch('/api/env');
		try {
			return (await response.json()).envOkay;
		} catch {
			return false;
		}
	};

	return {
		streamed: {
			isEnvOk: fetchEnvOk()
		}
	};
};
