# MCP Vision Relay

[English](README.md) | [中文说明](README.zh-CN.md)

MCP Vision Relay 是一个面向 Claude、Codex 等 MCP 客户端的视觉“中继站”，把本地安装的多模态 CLI（目前支持 Google Gemini CLI 与 Qwen CLI）统一成标准的 MCP 工具。

> **为什么需要它？** Claude Code 如果对接 k2、DeepSeek、MiniMax M2 等文本模型时，本身不具备多模态能力。接入 MCP Vision Relay 后，可借助 Gemini/Qwen CLI 来补齐看图能力，在不更换底层模型的情况下实现“物美价廉”的体验。

## 功能亮点
- **双提供方支持**：Gemini 与 Qwen 两套 CLI 都能通过统一工具调用。
- **三种输入形式**：本地路径、HTTP(S) URL、base64 全覆盖，自动校验大小与扩展名。
- **可配置执行**：模型、输出格式、sandbox、超时、附加 flag 均可按需调整。
- **Provider 抽象层**：新 CLI 只需实现 provider，就能无缝接入工具层。
- **结构化结果**：工具返回标准文本 + 元信息，方便在 IDE/CLI 中展示。

## 快速开始
### 前置条件
1. Node.js 18 或更高版本
2. 已在本地安装并配置好的 Gemini CLI、Qwen CLI（确认 `gemini -p "hi"`、`qwen -p "hi"` 可正常执行）

### 安装与构建
```bash
npm install
npm run build
```

### 启动 MCP 服务
```bash
# 开发模式：直接执行 TypeScript
npm run dev

# 生产模式：使用 dist 产物
npm run start
```
启动后会通过 stdio 暴露 MCP 服务，可配合 `claude mcp add`、`codex mcp add` 使用。

## 与 MCP 客户端集成示例
### Claude CLI
```bash
claude mcp add mcp-vision-relay -- npm run dev --prefix /absolute/path/to/mcp-vision-relay
```
### Codex CLI
```bash
codex mcp add mcp-vision-relay npm run dev --prefix /absolute/path/to/mcp-vision-relay
```

注册完成后，在对应会话中即可使用 `mcp-vision-relay` 的工具。

## 可用工具
### `gemini_analyze_image`
- 自动把 prompt 与 `@绝对路径` 组合传给 Gemini CLI。
- 支持自定义模型（`model`）、输出格式（`outputFormat`）、sandbox、额外参数等。

### `qwen_analyze_image`
- 对本地文件自动转成 data URL，确保 Qwen CLI 可以读取。
- 其他参数与 Gemini 版本保持一致。

工具返回 Markdown 文本，并带有 `model`、`imageSource`、`durationMs` 等元信息，便于后续处理。

## 配置说明
复制 `.env.example` 即可自定义：
- `GEMINI_CLI_COMMAND` / `QWEN_CLI_COMMAND`
- `GEMINI_DEFAULT_MODEL` / `QWEN_DEFAULT_MODEL`
- `GEMINI_OUTPUT_FORMAT`
- `MCP_COMMAND_TIMEOUT_MS`
- `MCP_MAX_IMAGE_BYTES`
- `MCP_ALLOWED_IMAGE_EXTENSIONS`
- `MCP_IMAGE_TEMP_DIR`

如果只想为特定调用覆盖 CLI，可在工具参数里传 `cliPath`。

## 本地验证脚本
```
npx tsx scripts/dev/manual-gemini-test.ts
npx tsx scripts/dev/manual-qwen-test.ts
```
脚本将直接调用 `runTool`，便于排查 CLI 输出问题。

## 项目结构
```
src/
  index.ts            # 程序入口
  config/             # 配置与默认值
  providers/          # Gemini/Qwen CLI 适配层
  server/             # MCP server wiring
  tools/              # 工具注册与 schema 定义
  utils/              # 文件、命令执行等工具函数
scripts/
  dev/                # 手动测试脚本
test-assets/          # 示例图片
```

## 开发规划
- [x] Gemini CLI 图像分析
- [x] Qwen CLI 图像分析
- [ ] 更多多模态 provider
- [ ] 自动化测试、CI、格式化

## 许可协议
MIT License，欢迎提交 issue / PR。

## 致谢
- [Model Context Protocol](https://github.com/modelcontextprotocol)
- [Google Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [@qwen-code/qwen-code](https://www.npmjs.com/package/@qwen-code/qwen-code)
