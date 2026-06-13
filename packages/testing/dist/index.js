const SALES_TOPICS = [
    "product demo",
    "pricing follow-up",
    "enterprise rollout",
    "security review",
    "trial extension",
];
const SUPPORT_TOPICS = [
    "login issue",
    "payment retry",
    "message sync",
    "stuck approval",
    "connector session",
];
const BOOKING_TOPICS = [
    "meeting request",
    "availability check",
    "schedule change",
    "confirmation note",
    "deposit reminder",
];
export function buildDemoInboxBlueprints() {
    const tenants = [
        buildSalesTenant(),
        buildSupportTenant(),
        buildBookingTenant(),
    ];
    return { tenants };
}
function buildSalesTenant() {
    return {
        tenantId: "11111111-1111-1111-1111-111111111111",
        name: "sales-demo",
        channel: "zalo",
        workflow: {
            tenantId: "11111111-1111-1111-1111-111111111111",
            defaultModel: "openai/gpt-4.1-mini",
            classifierModel: "openai/gpt-4.1-mini",
            embeddingModel: "text-embedding-3-small",
            maxToolTurns: 6,
            temperature: 0.2,
        },
        contacts: buildContacts("sales", SALES_TOPICS),
        knowledgeDocuments: buildKnowledgeDocuments("sales", [
            "Sales playbook",
            "ROI calculator",
        ]),
    };
}
function buildSupportTenant() {
    return {
        tenantId: "22222222-2222-2222-2222-222222222222",
        name: "support-demo",
        channel: "zalo",
        workflow: {
            tenantId: "22222222-2222-2222-2222-222222222222",
            defaultModel: "openai/gpt-4.1-mini",
            classifierModel: "openai/gpt-4.1-mini",
            embeddingModel: "text-embedding-3-small",
            maxToolTurns: 4,
            temperature: 0.15,
        },
        contacts: buildContacts("support", SUPPORT_TOPICS),
        knowledgeDocuments: buildKnowledgeDocuments("support", [
            "Support macros",
            "Connector troubleshooting",
        ]),
    };
}
function buildBookingTenant() {
    return {
        tenantId: "33333333-3333-3333-3333-333333333333",
        name: "booking-demo",
        channel: "zalo",
        workflow: {
            tenantId: "33333333-3333-3333-3333-333333333333",
            defaultModel: "openai/gpt-4.1-mini",
            classifierModel: "openai/gpt-4.1-mini",
            embeddingModel: "text-embedding-3-small",
            maxToolTurns: 5,
            temperature: 0.1,
        },
        contacts: buildContacts("booking", BOOKING_TOPICS),
        knowledgeDocuments: buildKnowledgeDocuments("booking", [
            "Booking FAQ",
            "Cancellation policy",
        ]),
    };
}
function buildContacts(prefix, topics) {
    return topics.map((topic, topicIndex) => {
        const externalUserId = `${prefix}-contact-${topicIndex + 1}`;
        const displayName = `${capitalize(prefix)} ${topicIndex + 1}`;
        return {
            externalUserId,
            displayName,
            phone: `+84${String(900000000 + topicIndex).slice(1)}`,
            conversations: [
                {
                    externalThreadId: `${prefix}-thread-${topicIndex + 1}`,
                    status: topicIndex % 3 === 0 ? "open" : topicIndex % 3 === 1 ? "pending" : "closed",
                    messages: buildConversationMessages(prefix, topic, topicIndex),
                },
            ],
        };
    });
}
function buildConversationMessages(prefix, topic, topicIndex) {
    const createdAtOffset = topicIndex + 1;
    return [
        {
            direction: "inbound",
            messageType: "text",
            text: `Xin chào, mình cần hỗ trợ về ${topic}.`,
            idempotencyKey: `${prefix}-${topicIndex + 1}-inbound`,
            receivedOffsetHours: createdAtOffset * 5,
        },
        {
            direction: "outbound",
            messageType: "text",
            text: `Cảm ơn bạn. Mình đã ghi nhận yêu cầu về ${topic}.`,
            idempotencyKey: `${prefix}-${topicIndex + 1}-outbound`,
            receivedOffsetHours: createdAtOffset * 5 - 1,
        },
    ];
}
function buildKnowledgeDocuments(prefix, titles) {
    return titles.map((title, titleIndex) => ({
        sourceType: `${prefix}-guide`,
        title,
        content: `${title} for the ${prefix} team.`,
        chunks: [
            `${title} overview`,
            `${title} common cases`,
            `${title} escalation path`,
        ].slice(0, titleIndex === 0 ? 2 : 3),
    }));
}
function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
