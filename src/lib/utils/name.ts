export const nameToAvatarFallback = (name?: string) => {
	if (!name) return "NN";
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase();
};
