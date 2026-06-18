import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Subject, Observable } from "rxjs";
import { loadApiEnv } from "@platform/config";

@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly eventSubject = new Subject<unknown>();
  private subClient: any = null;
  private pubClient: any = null;

  constructor() {
    const env = loadApiEnv();
    if (!env.REDIS_URL) {
      console.log("[SseService] No REDIS_URL — using in-memory pub/sub");
      return;
    }

    import("ioredis").then(({ default: Redis }) => {
      this.subClient = new Redis(env.REDIS_URL!);
      this.pubClient = new Redis(env.REDIS_URL!);

      this.subClient.subscribe("platform:sse", (err?: Error | null) => {
        if (err) console.error("[SseService] Failed to subscribe:", err);
      });

      this.subClient.on("message", (_channel: string, message: string) => {
        try {
          this.eventSubject.next(JSON.parse(message));
        } catch {
          // ignore malformed messages
        }
      });
    });
  }

  getEventStream(): Observable<unknown> {
    return this.eventSubject.asObservable();
  }

  async publish(event: { type: string; payload: unknown }) {
    if (this.pubClient) {
      await this.pubClient.publish("platform:sse", JSON.stringify(event));
    } else {
      this.eventSubject.next(event);
    }
  }

  onModuleDestroy() {
    this.subClient?.disconnect();
    this.pubClient?.disconnect();
  }
}
