import {
  AbortError,
  ClientError,
  Render,
  RenderError,
  ServerError,
} from "@renderinc/sdk";

let client: Render | null = null;

export function getRenderClient(): Render {
  if (!client) {
    const localDevUrl = process.env.RENDER_TASKS_URL;
    client = new Render({
      useLocalDev: !!localDevUrl,
      localDevUrl: localDevUrl,
    });
  }
  return client;
}

/**
 * Map Render SDK errors to HTTP status codes and messages.
 */
export function toSdkErrorResponse(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof AbortError) {
    return { status: 504, message: "Request to Render API timed out" };
  }
  if (error instanceof ClientError) {
    return {
      status: error.statusCode ?? 400,
      message: error.message || "Invalid request to Render API",
    };
  }
  if (error instanceof ServerError) {
    return {
      status: error.statusCode ?? 502,
      message: "Render API error",
    };
  }
  if (error instanceof RenderError) {
    return { status: 502, message: error.message || "Render API error" };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : "Unexpected error",
  };
}
