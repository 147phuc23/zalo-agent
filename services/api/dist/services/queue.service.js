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
import { Queue } from "bullmq";
import { loadApiEnv } from "@platform/config";
let QueueService = class QueueService {
    queue;
    constructor() {
        const env = loadApiEnv();
        this.queue = new Queue("message.received", {
            connection: { url: env.REDIS_URL },
        });
    }
    async enqueueMessageReceived(payload) {
        const queueJobId = payload.idempotencyKey.replaceAll(":", "_");
        await this.queue.add("message.received", payload, 
        // jobId ensures dedupe at queue-level too
        { jobId: queueJobId, removeOnComplete: 1000, removeOnFail: 1000 });
    }
};
QueueService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], QueueService);
export { QueueService };
