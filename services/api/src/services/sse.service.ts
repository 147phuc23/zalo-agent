import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Subject, Observable } from "rxjs";
import { Redis } from "ioredis";
import { loadApiEnv } from "@platform/config";

@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly subClient: Redis;
  private readonly pubClient: Redis;
  private readonly eventSubject = new Subject<unknown>();

  constructor() {
    const env = loadApiEnv();
    this.subClient = new Redis(env.REDIS_URL);
    this.pubClient = new Redis(env.REDIS_URL);

    this.subClient.subscribe("platform:sse", (err?: Error | null) => {
      if (err) {
        console.error("[SseService] Failed to subscribe to platform:sse:", err);
      } else {
        console.log("[SseService] Subscribed to platform:sse channel");
      }
    });

    this.subClient.on("message", (channel: string, message: string) => {
      if (channel === "platform:sse") {
        try {
          const parsed = JSON.parse(message);
          this.eventSubject.next(parsed);
        } catch (err) {
          console.error("[SseService] Failed to parse message:", err);
        }
      }
    });
  }

  getEventStream(): Observable<unknown> {
    return this.eventSubject.asObservable();
  }

  async publish(event: { type: string; payload: unknown }) {
    await this.pubClient.publish("platform:sse", JSON.stringify(event));
  }

  onModuleDestroy() {
    this.subClient.disconnect();
    this.pubClient.disconnect();
  }
}
