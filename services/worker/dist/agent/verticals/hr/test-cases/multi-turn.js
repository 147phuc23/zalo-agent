export const multiTurnMemory = {
    id: "multi-turn-memory",
    description: "User provides information across multiple turns, checking if agent remembers",
    turns: [
        { role: "user", content: "Chào bạn, mình tên là Phúc." },
        { role: "user", content: "Mình có 5 năm kinh nghiệm làm Backend." },
        { role: "user", content: "Tên mình là gì và mình có bao nhiêu năm kinh nghiệm?" },
    ],
    assertions: [
        { type: "response-contains", value: "Phúc" },
        { type: "response-contains", value: "5" },
    ],
};
