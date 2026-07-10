const exactIPv4Pattern =
  /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/;

export function isExactIPv4Host(value) {
  return (
    exactIPv4Pattern.test(value) &&
    value.split(".").every((octet) => Number(octet) <= 255)
  );
}

export function readOptionalExactIPv4Host(value, name) {
  if (value === undefined) {
    return undefined;
  }

  const host = value.trim();

  if (host.length === 0) {
    return undefined;
  }

  if (!isExactIPv4Host(host)) {
    throw new Error(
      `${name} must be an exact IPv4 address (four decimal octets from 0 to 255) without a protocol, port, path, hostname, IPv6 literal, or wildcard; received ${JSON.stringify(host)}.`,
    );
  }

  return host;
}
