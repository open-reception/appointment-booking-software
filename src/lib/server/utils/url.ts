export const redactDbUrl = (input: string) => {
  const url = new URL(input);
  url.username = "redacted-user";
  url.password = "redacted-pw";
  return url.toString();
};

export const isLinkValid = (link: string | undefined) => {
  return (
    link?.startsWith("http://") || link?.startsWith("https://") || link === "" || link === undefined
  );
};
