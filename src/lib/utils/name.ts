export const nameToAvatarFallback = (name?: string) => {
  if (!name) return "NN";
  return name
    .replaceAll(".", "")
    .replaceAll("Prof", "")
    .replaceAll("Dr", "")
    .replaceAll("med", "")
    .replaceAll("habil", "")
    .replaceAll("Dipl", "")
    .replaceAll("MD", "")
    .replaceAll("PhD", "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};
