import test from 'node:test'
import assert from 'node:assert/strict'
import { handoffEnvironment,PARENT_SESSION_VARIABLES } from '../src/core/launch-environment'
test('independent handoffs do not inherit another agent’s session identity but retain user policy and auth configuration',()=>{
  const original:NodeJS.ProcessEnv={PATH:'/example/bin',SYNTHETIC_AUTH_SETTING:'keep',CODEX_SANDBOX_NETWORK_DISABLED:'1',...Object.fromEntries(PARENT_SESSION_VARIABLES.map(key=>[key,'parent-context']))}
  const clean=handoffEnvironment(original)
  for(const key of PARENT_SESSION_VARIABLES){assert.equal(clean[key],undefined);assert.equal(original[key],'parent-context')}
  assert.equal(clean.PATH,original.PATH)
  assert.equal(clean.SYNTHETIC_AUTH_SETTING,'keep')
  assert.equal(clean.CODEX_SANDBOX_NETWORK_DISABLED,'1')
})
