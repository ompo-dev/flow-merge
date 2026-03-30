import type {
  RuntimeWebhookDelivery,
  RuntimeWebhookResponse,
  RuntimeWebhookRoute,
} from "@/lib/runtime-types";

export interface DesktopRuntimeStatus {
  running: boolean;
  port: number;
  baseUrl: string;
}

function isDesktopRuntimeAvailable() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getDesktopRuntimeStatus(): Promise<DesktopRuntimeStatus | null> {
  if (!isDesktopRuntimeAvailable()) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopRuntimeStatus>("runtime_status");
}

export async function syncDesktopWebhookRoutes(routes: RuntimeWebhookRoute[]) {
  if (!isDesktopRuntimeAvailable()) return 0;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("runtime_sync_webhooks", { routes });
}

export async function completeDesktopWebhookDelivery(
  completion: RuntimeWebhookResponse & { deliveryId: string },
) {
  if (!isDesktopRuntimeAvailable()) return false;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("runtime_complete_webhook_delivery", {
    completion: {
      deliveryId: completion.deliveryId,
      status: completion.status,
      body: completion.body,
      headers: completion.headers ?? {},
    },
  });
}

export async function listenDesktopWebhookDeliveries(
  handler: (delivery: RuntimeWebhookDelivery) => void | Promise<void>,
) {
  if (!isDesktopRuntimeAvailable()) {
    return () => {};
  }

  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<RuntimeWebhookDelivery>("runtime://webhook", (event) => {
    void handler(event.payload);
  });

  return unlisten;
}
