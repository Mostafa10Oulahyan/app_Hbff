const RETRY_DELAYS_MS = [400, 1000];

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const supabaseFetch: typeof fetch = async (input, init) => {
  const method =
    init?.method ??
    (typeof input !== "string" && "method" in input ? input.method : "GET");
  const canRetry = method.toUpperCase() === "GET";

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (
        canRetry &&
        attempt < RETRY_DELAYS_MS.length &&
        [502, 503, 504].includes(response.status)
      ) {
        await wait(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return response;
    } catch (error) {
      if (!canRetry || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
};
