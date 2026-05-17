export type Assertion =
  | { type: "response-contains"; value: string }
  | { type: "response-not-contains"; value: string }
  | { type: "skill-called"; skillId: string }
  | { type: "skill-not-called"; skillId: string };

export type TestCase = {
  id: string;
  description: string;
  turns: Array<{ role: "user"; content: string }>;
  assertions: Assertion[];
};
