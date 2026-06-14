var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";
import { Redis } from "ioredis";
import { loadApiEnv } from "@platform/config";
let SseService = class SseService {
    subClient;
    pubClient;
    eventSubject = new Subject();
    constructor() {
        const env = loadApiEnv();
        this.subClient = new Redis(env.REDIS_URL);
        this.pubClient = new Redis(env.REDIS_URL);
        this.subClient.subscribe("platform:sse", (err) => {
            if (err) {
                console.error("[SseService] Failed to subscribe to platform:sse:", err);
            }
            else {
                console.log("[SseService] Subscribed to platform:sse channel");
            }
        });
        this.subClient.on("message", (channel, message) => {
            if (channel === "platform:sse") {
                try {
                    const parsed = JSON.parse(message);
                    this.eventSubject.next(parsed);
                }
                catch (err) {
                    console.error("[SseService] Failed to parse message:", err);
                }
            }
        });
    }
    getEventStream() {
        return this.eventSubject.asObservable();
    }
    async publish(event) {
        await this.pubClient.publish("platform:sse", JSON.stringify(event));
    }
    onModuleDestroy() {
        this.subClient.disconnect();
        this.pubClient.disconnect();
    }
};
SseService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], SseService);
export { SseService };
