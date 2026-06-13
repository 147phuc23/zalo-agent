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
    messageReceivedQueue;
    messageSendQueue;
    crmSyncQueue;
    humanTaskCreateQueue;
    knowledgeEmbedQueue;
    deadLetterQueue;
    constructor() {
        const env = loadApiEnv();
        const connection = { url: env.REDIS_URL };
        this.messageReceivedQueue = new Queue("message.received", {
            connection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        this.messageSendQueue = new Queue("message.send", {
            connection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        this.crmSyncQueue = new Queue("crm.sync", {
            connection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        this.humanTaskCreateQueue = new Queue("human.task.create", {
            connection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        this.knowledgeEmbedQueue = new Queue("knowledge.embed", {
            connection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        this.deadLetterQueue = new Queue("dead-letter", {
            connection: { url: env.REDIS_URL },
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
    }
    async enqueueMessageReceived(payload) {
        const queueJobId = payload.idempotencyKey.replaceAll(":", "_");
        await this.messageReceivedQueue.add("message.received", payload, { jobId: queueJobId });
    }
    async enqueueMessageSend(payload) {
        const jobId = (payload.idempotencyKey ?? `${payload.tenantId}:${payload.threadId}:${payload.text}`).replaceAll(":", "_");
        await this.messageSendQueue.add("message.send", payload, { jobId });
    }
    async enqueueCrmSync(payload) {
        await this.crmSyncQueue.add("crm.sync", payload);
    }
    async enqueueHumanTaskCreate(payload) {
        await this.humanTaskCreateQueue.add("human.task.create", payload);
    }
    async enqueueKnowledgeEmbed(payload) {
        await this.knowledgeEmbedQueue.add("knowledge.embed", payload);
    }
    async enqueueDeadLetter(payload) {
        await this.deadLetterQueue.add("dead-letter", payload);
    }
};
QueueService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], QueueService);
export { QueueService };
const DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: {
        type: "exponential",
        delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
};
