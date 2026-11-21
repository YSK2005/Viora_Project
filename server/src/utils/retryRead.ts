// Only use for idempotent reads/connectivity, never replay financial mutations.
export async function retryRead<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const code =
        (error as { code?: string; errorCode?: string }).code ||
        (error as { errorCode?: string }).errorCode;
      if (
        attempt >= attempts - 1 ||
        !["P1001", "P1002", "P1017", "P2024"].includes(code || "")
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
    }
  }
}
