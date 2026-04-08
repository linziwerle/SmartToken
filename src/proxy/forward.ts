// Forward a compressed request to the real API and stream the response back

export async function forwardRequest(
  targetUrl: string,
  method: string,
  headers: Headers,
  body: string
): Promise<Response> {
  // Clone headers, removing hop-by-hop headers
  const forwardHeaders = new Headers();
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    // Skip hop-by-hop and proxy-specific headers
    if (
      lower === "host" ||
      lower === "connection" ||
      lower === "transfer-encoding" ||
      lower.startsWith("x-smart-token")
    ) {
      continue;
    }
    forwardHeaders.set(key, value);
  }

  const response = await fetch(targetUrl, {
    method,
    headers: forwardHeaders,
    body: method !== "GET" && method !== "HEAD" ? body : undefined,
  });

  // Pass the response through untouched — including streaming SSE responses
  // Bun's fetch returns a Response with a readable body that we can forward directly
  const responseHeaders = new Headers();
  for (const [key, value] of response.headers.entries()) {
    const lower = key.toLowerCase();
    // Bun's fetch() auto-decompresses gzip/br responses, but the original
    // Content-Encoding header is still present. Forwarding it causes the
    // client to decompress already-decompressed data → ZlibError.
    if (lower === "content-encoding" || lower === "content-length") continue;
    responseHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
