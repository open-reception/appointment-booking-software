export const redactDbUrl = (input: string) => {
  const url = new URL(input);
  url.username = "redacted-user";
  url.password = "redacted-pw";
  return url.toString();
};
