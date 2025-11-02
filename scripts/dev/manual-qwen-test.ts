import "dotenv/config";
import { runTool } from "../../src/tools/index.js";

async function main() {
  const result = await runTool("qwen_analyze_image", {
    image: "test-assets/sample2.jpg",
    prompt: "请用一句中文描述这张图。",
    timeoutMs: 60000,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
