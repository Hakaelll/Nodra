import { describe, expect, it, vi } from "vitest";
import {
  type ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiErrors } from "./common";

function capture(error: unknown) {
  const send = vi.fn();
  const log = vi.fn();
  const reply = { status: vi.fn().mockReturnValue({ send }) };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: "request-canary", log: { error: log } }),
      getResponse: () => reply,
    }),
  } as unknown as ArgumentsHost;
  new ApiErrors().catch(error, host);
  return {
    status: reply.status.mock.calls[0][0],
    body: send.mock.calls[0][0],
    log,
  };
}

describe("public API errors", () => {
  const privateMessage = "password=private-canary postgres://secret-canary";

  it.each([
    [new Error(privateMessage), 500],
    [new InternalServerErrorException(privateMessage), 500],
    [new ServiceUnavailableException(privateMessage), 503],
  ])("keeps internal details out of responses and logs", (error, status) => {
    error.stack = "private-stack-canary";
    const result = capture(error);
    expect(result.status).toBe(status);
    expect(result.body).toEqual({
      code: "INTERNAL_ERROR",
      message: "No se pudo completar la operación. Vuelve a intentarlo.",
      requestId: "request-canary",
    });
    expect(result.log).toHaveBeenCalledOnce();
    const serialized = JSON.stringify([result.body, result.log.mock.calls]);
    expect(serialized).not.toContain("private-canary");
    expect(serialized).not.toContain("secret-canary");
    expect(serialized).not.toContain("private-stack-canary");
  });

  it("preserves actionable validation messages and correlation without error logging", () => {
    const result = capture(
      new BadRequestException("La fecha final debe ser posterior."),
    );
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      message: "La fecha final debe ser posterior.",
      requestId: "request-canary",
    });
    expect(result.log).not.toHaveBeenCalled();
  });
});
