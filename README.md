[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/ah-wq-mcp-vision-relay-badge.png)](https://mseep.ai/app/ah-wq-mcp-vision-relay)

# MCP Vision Relay

[English](README.md) | [中文说明](README.zh-CN.md)

MCP Vision Relay 将本地安装的多模态 CLI（目前支持 Google Gemini CLI 与 Qwen CLI）封装为 Model Context Protocol (MCP) 服务器，帮助 Claude、Codex 等支持 MCP 的工具直接使用它们的看图能力。

<a href="https://glama.ai/mcp/servers/@ah-wq/mcp-vision-relay">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@ah-wq/mcp-vision-relay/badge" alt="Vision Relay MCP server" />
</a>

> **Why it matters:** when Claude Code connects to providers such as k2, DeepSeek, or MiniMax M2, the backing models today are text-only—no built-in vision. By relaying calls through Gemini/Qwen CLI, MCP Vision Relay gives those deployments an inexpensive path to regain multimodal features without switching providers.

## Features
- **Unified image tools** – `gemini_analyze_image` 与 `qwen_analyze_image` 两个工具覆盖路径、URL、base64 三种输入。
- **Provider relay architecture** – 通过 provider 抽象切换或扩展不同 CLI，保留模型、输出格式等配置能力。
- **Robust input handling** – 自动校验图片大小、扩展名，必要时下载或写入临时文件并在使用后清理。
- **Configurable execution** – 支持可选 sandbox、超时、额外旗标、模型覆盖，以及 `.env`/环境变量配置。
- **Actionable outputs** – 对 stdout 进行规整并附加元信息，便于客户端在 UI 中展示或后续处理。

## Quick Start
### Prerequisites
1. Node.js ≥ 18
2. 已安装并能在命令行直接调用的 [Gemini CLI](https://github.com/google-gemini/gemini-cli) 与/或 [Qwen CLI](https://www.npmjs.com/package/@qwen-code/qwen-code)
3. 对应 CLI 的登陆/鉴权已完成（确保 `gemini -p "hi"`、`qwen -p "hi"` 能返回结果）

### Install & Build
```bash
npm install
npm run build
```

### Run the MCP server
```bash
# 开发模式（tsx 直接启动 TypeScript）
npm run dev

# 生产模式（使用编译产物）
npm run start
```
服务器通过 stdio 与 MCP 客户端通信，适用于 `claude mcp add`、`codex mcp add` 等命令。

## MCP Integration Examples
> ⚠️ When registering the server with an MCP client, invoke the entry point directly. Running `npm run dev` inside the registration command causes npm to print a banner on stdout, which breaks the MCP handshake. If you must keep the npm script, wrap it with `npm --silent run dev --` so no extra text reaches stdout.

### Claude
```bash
claude mcp add mcp-vision-relay -- npx tsx /absolute/path/to/mcp-vision-relay/src/index.ts
```
### Codex CLI
```bash
codex mcp add mcp-vision-relay -- node /absolute/path/to/mcp-vision-relay/dist/index.js
```
完成后即可在会话/任务中选择 `mcp-vision-relay` 的工具调用。

## Available Tools
### `gemini_analyze_image`
分析图像并返回 Gemini CLI 给出的描述。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `image` | string | 必填；本地路径、HTTP(S) URL 或 base64 字符串 |
| `prompt` | string? | 额外指令，默认使用 `GEMINI_DEFAULT_PROMPT` |
| `model` | string? | 覆盖默认模型（如 `gemini-2.0-flash`） |
| `outputFormat` | `"text" \| "json"`? | 控制 `-o` 输出格式 |
| `sandbox` | boolean? | 是否添加 `-s` sandbox 旗标 |
| `extraFlags` | string[]? | 附加自定义参数 |
| `timeoutMs` | number? | CLI 超时（默认 120000ms） |

返回内容包含一段 Markdown 文本与元信息（模型、输入来源、耗时等）。

### `qwen_analyze_image`
走 Qwen CLI 进行图像理解。逻辑与 Gemini 类似，但会在需要时自动把本地文件转成 data URL 供 CLI 读取。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `image` | string | 必填；本地路径、HTTP(S) URL 或 base64 字符串 |
| `prompt` | string? | 额外指令，默认使用 `QWEN_DEFAULT_PROMPT` |
| `model` | string? | Qwen 模型（如 `qwen2.5-omni-medium`） |
| `sandbox` | boolean? | 是否加 `-s` |
| `extraFlags` | string[]? | 附加参数 |
| `timeoutMs` | number? | CLI 超时（默认 120000ms） |

## Configuration
复制 `.env.example` 进行配置，常用条目：

- `GEMINI_CLI_COMMAND` / `QWEN_CLI_COMMAND`：CLI 可执行文件路径。
- `GEMINI_DEFAULT_MODEL` / `QWEN_DEFAULT_MODEL`：默认模型名。
- `GEMINI_OUTPUT_FORMAT`：控制 Gemini 输出（`text` 或 `json`）。
- `MCP_COMMAND_TIMEOUT_MS`：全局超时（毫秒）。
- `MCP_MAX_IMAGE_BYTES`：允许的最大图片大小。
- `MCP_ALLOWED_IMAGE_EXTENSIONS`：允许的扩展名列表。
- `MCP_IMAGE_TEMP_DIR`：存放下载/解码后临时文件的目录。

如需针对单次调用覆盖 CLI 命令，可在工具参数中提供 `cliPath`（Gemini/Qwen 均支持）。

## Local Diagnostics
项目提供两个简单脚本，便于手动验证 CLI 调用：

```bash
npx tsx scripts/dev/manual-gemini-test.ts
npx tsx scripts/dev/manual-qwen-test.ts
```
确保在执行前已完成 `npm run build` 或使用 `ts-node`/`tsx`。

## Project Structure
```
src/
  index.ts                 # 程序入口，加载 env 并启动 MCP 服务器
  config/                  # 配置解析（appConfig 等）
  providers/               # CLI provider 适配层（Gemini/Qwen）
  server/                  # MCP server wiring
  tools/                   # MCP 工具定义与注册
  utils/                   # 文件、CLI 调度等公共工具
scripts/
  dev/                     # 手动验证脚本
test-assets/               # 示例图像资源
```

## Roadmap
- ✅ Gemini CLI 图像分析
- ✅ Qwen CLI 图像分析（含自动 data URL）
- ⏳ 资源列表与更多多模态 provider
- ⏳ 自动化测试与 lint/format pipeline

## License
MIT License. 欢迎 issue / PR 贡献改进。

## Acknowledgements
- [Model Context Protocol](https://github.com/modelcontextprotocol)
- [Google Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [@qwen-code/qwen-code](https://www.npmjs.com/package/@qwen-code/qwen-code)