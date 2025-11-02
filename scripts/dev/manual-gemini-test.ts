import "dotenv/config";
import { runTool } from "../../src/tools/index.js";

async function main() {
  const result = await runTool("gemini_analyze_image", {
    image: "test-assets/sample2.jpg",
    prompt: "Describe the scene in this photo.",
    timeoutMs: 60000,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
