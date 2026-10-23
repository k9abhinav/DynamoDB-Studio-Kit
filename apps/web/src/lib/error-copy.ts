const TLS_CODES = ["CERT_", "ERR_SSL", "TLS", "EPROTO"];

function isTls(code: string | undefined): boolean {
  if (code === undefined) {
    return false;
  }
  return TLS_CODES.some((prefix) => code.includes(prefix));
}

export function errorCopy(
  error: {
    code: string;
    message: string;
    details?: { awsCode?: string | undefined; networkCode?: string | undefined };
  },
  endpoint?: string,
): string {
  if (error.code === "ENDPOINT_UNREACHABLE") {
    if (isTls(error.details?.networkCode)) {
      return "Couldn't establish a secure connection.";
    }
    const target = endpoint === undefined || endpoint.length === 0 ? "the endpoint" : endpoint;
    return `Couldn't reach ${target}. Is DynamoDB running and the URL correct?`;
  }
  if (error.code === "ACCESS_DENIED") {
    if (error.details?.awsCode === "AccessDeniedException") {
      return "These credentials can't list tables (missing dynamodb:ListTables).";
    }
    return "AWS rejected these credentials.";
  }
  return error.message;
}
