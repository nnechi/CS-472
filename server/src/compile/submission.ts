import { createExecutionPlan, InvalidCompileRequestError } from "./plan";

export interface CodeReceipt {
  language: "javascript" | "typescript";
  bytes: number;
}

// Validate what arrived over the socket. Receipt does not compile, run, or
// retain the submitted source code.
export function receiveCode(input: unknown): CodeReceipt {
  const { request } = createExecutionPlan(input);
  if (request.language !== "javascript" && request.language !== "typescript") {
    throw new InvalidCompileRequestError("Only JavaScript and TypeScript are available here");
  }
  return {
    language: request.language,
    bytes: Buffer.byteLength(request.code, "utf8"),
  };
}
