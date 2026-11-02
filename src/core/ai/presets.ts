import type { ProviderPreset } from '../contracts'

/**
 * Provider endpoints checked against the linked official documentation on 2026-11-03.
 * Models are intentionally entered by the user or loaded from the provider.
 * These are ordinary API endpoints, not Coding/Agent/Token Plan subscription routes.
 * Users can explicitly edit endpoints for their region, workspace, or plan.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', region: 'global', docsUrl: 'https://developers.openai.com/api/reference/resources/chat' },
  { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', region: 'global', docsUrl: 'https://platform.claude.com/docs/en/api/messages/create' },
  { id: 'gemini', name: 'Google Gemini', protocol: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', region: 'global', docsUrl: 'https://aistudio.google.com/docs/openai', modelsOptional: true },
  { id: 'openrouter', name: 'OpenRouter', protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1', region: 'global', docsUrl: 'https://openrouter.ai/docs/api_reference/overview', modelsOptional: true },
  // xAI still offers Chat Completions. Responses-only features are not implied here.
  { id: 'xai', name: 'xAI / Grok', protocol: 'openai', baseUrl: 'https://api.x.ai/v1', region: 'global', docsUrl: 'https://docs.x.ai/developers/model-capabilities/legacy/chat-completions', modelsOptional: true },
  { id: 'deepseek', name: 'DeepSeek', protocol: 'openai', baseUrl: 'https://api.deepseek.com', region: 'cn', docsUrl: 'https://api-docs.deepseek.com/', modelsOptional: true },
  // The documented legacy Beijing host remains supported; workspace/region hosts
  // can be entered explicitly. Model-list availability is not a connection check.
  { id: 'qwen', name: 'Qwen / 阿里云百炼', protocol: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', region: 'cn', docsUrl: 'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope', modelsOptional: true },
  { id: 'glm', name: 'GLM / 智谱', protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', region: 'cn', docsUrl: 'https://docs.bigmodel.cn/cn/guide/develop/openai/introduction', modelsOptional: true },
  { id: 'moonshot', name: 'Moonshot / Kimi', protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1', region: 'cn', docsUrl: 'https://platform.kimi.com/docs/get-api-key', modelsOptional: true },
  { id: 'doubao', name: 'Doubao / 火山方舟', protocol: 'openai', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', region: 'cn', docsUrl: 'https://console.volcengine.com/ark/region:cn-beijing/docs/integrate-third-party-tools', modelsOptional: true },
  { id: 'siliconflow', name: 'SiliconFlow / 硅基流动', protocol: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', region: 'cn', docsUrl: 'https://docs.siliconflow.cn/docs/userguide/capabilities/text-generation', modelsOptional: true },
  { id: 'ollama', name: 'Ollama', protocol: 'ollama', baseUrl: 'http://localhost:11434', region: 'local', docsUrl: 'https://docs.ollama.com/api/chat' },
  { id: 'custom', name: 'Custom / 自定义', protocol: 'openai', baseUrl: '', region: 'global', docsUrl: 'https://developers.openai.com/api/reference/resources/chat', modelsOptional: true },
]
