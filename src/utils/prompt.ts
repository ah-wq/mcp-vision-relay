import path from "node:path";

export function createAttachmentReference(filePath: string): string {
  const absolutePath = path.resolve(filePath).replace(/\\/g, "/");
  if (/\s|"/u.test(absolutePath)) {
    const escaped = absolutePath.replace(/"/g, '\\"');
    return `@"${escaped}"`;
  }
  return `@${absolutePath}`;
}
