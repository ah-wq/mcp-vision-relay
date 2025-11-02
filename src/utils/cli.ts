import { spawn } from "node:child_process";

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
}

export class CommandError extends Error {
  constructor(
    message: string,
    public readonly result: CommandResult
  ) {
    super(message);
    this.name = "CommandError";
  }
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<CommandResult> {
  const {
    cwd,
    env,
    timeoutMs,
    onStdoutChunk,
    onStderrChunk,
  } = options;

  return new Promise<CommandResult>((resolve, reject) => {
    const start = Date.now();
    const child = spawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer =
      typeof timeoutMs === "number"
        ? setTimeout(() => {
            if (!settled) {
              child.kill("SIGTERM");
              settled = true;
              reject(
                new CommandError("Command timed out", {
                  stdout,
                  stderr,
                  exitCode: null,
                  signal: "SIGTERM",
                  durationMs: Date.now() - start,
                })
              );
            }
          }, timeoutMs)
        : undefined;

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      onStdoutChunk?.(text);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      onStderrChunk?.(text);
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      reject(
        new CommandError(error.message, {
          stdout,
          stderr,
          exitCode: null,
          signal: null,
          durationMs: Date.now() - start,
        })
      );
    });

    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }

      const result: CommandResult = {
        stdout,
        stderr,
        exitCode: code,
        signal,
        durationMs: Date.now() - start,
      };

      if (code === 0) {
        resolve(result);
      } else {
        reject(
          new CommandError(
            `Command "${command}" exited with code ${code}`,
            result
          )
        );
      }
    });
  });
}
