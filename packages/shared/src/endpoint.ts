export interface EndpointInterpretation {
  blank: boolean;
  loopback: boolean;
  endpoint?: string;
  region?: string;
  suggestedAuth: "local" | "default-chain";
  suggestedEnv: "local" | "dev";
  error?: string;
  hint?: string;
}

const COMMAND_HINT = "That looks like a command. Paste the endpoint URL instead.";
const INVALID_URL = "Enter a valid http or https URL.";
const CREDENTIALS_IN_URL = "Remove credentials from the URL and use the auth fields.";

function invalid(message = INVALID_URL): EndpointInterpretation {
  return {
    blank: false,
    loopback: false,
    suggestedAuth: "default-chain",
    suggestedEnv: "dev",
    error: message,
  };
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "host.docker.internal"
  );
}

export function interpretEndpoint(raw: string): EndpointInterpretation {
  const input = raw.trim();
  if (input.length === 0) {
    return { blank: true, loopback: false, suggestedAuth: "default-chain", suggestedEnv: "dev" };
  }
  if (/^aws\s/i.test(input)) {
    return {
      blank: false,
      loopback: false,
      suggestedAuth: "default-chain",
      suggestedEnv: "dev",
      hint: COMMAND_HINT,
      error: COMMAND_HINT,
    };
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
    ? input
    : `${/amazonaws\.com/i.test(input) ? "https" : "http"}://${input}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return invalid();
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return invalid();
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return invalid(CREDENTIALS_IN_URL);
  }

  const hostname = url.hostname.replaceAll(/^\[|\]$/g, "");
  if (hostname === "amazonaws.com" || hostname.endsWith(".amazonaws.com")) {
    url.protocol = "https:";
  }
  const regionMatch = /^dynamodb\.([a-z0-9-]+)\.amazonaws\.com$/i.exec(hostname);
  const region = regionMatch?.[1]?.toLowerCase();
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  if (path === "/") {
    path = "";
  }
  const endpoint = `${url.protocol}//${url.host}${path}`;
  const loopback = isLoopbackHost(hostname);

  return {
    blank: false,
    endpoint,
    loopback,
    suggestedAuth: loopback ? "local" : "default-chain",
    suggestedEnv: loopback ? "local" : "dev",
    ...(region === undefined ? {} : { region }),
  };
}
