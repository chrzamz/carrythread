/** Drop parent-agent transport identity, never authentication or sandbox/approval settings. */
export const PARENT_SESSION_VARIABLES = ['CODEX_THREAD_ID','CODEX_SESSION_ID','CODEX_TOOL_CALL_ID','CODEX_TASK_WORKSPACE_VERIFYING_IDENTITY','CLAUDE_CODE_SESSION_ID','CLAUDECODE'] as const
export function handoffEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result={...environment}
  for(const name of PARENT_SESSION_VARIABLES)delete result[name]
  return result
}
