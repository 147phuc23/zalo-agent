import { randomUUID } from "node:crypto";
export function requestIdMiddleware(req, res, next) {
    const requestId = req.header("x-request-id")?.trim() || randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
}
