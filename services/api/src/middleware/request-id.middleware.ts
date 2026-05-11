import { randomUUID } from "node:crypto";

type RequestLike = {
  header(name: string): string | undefined;
  requestId?: string;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
};

type NextLike = () => void;

export function requestIdMiddleware(req: RequestLike, res: ResponseLike, next: NextLike) {
  const requestId = req.header("x-request-id")?.trim() || randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
