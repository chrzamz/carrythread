import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { basename, dirname, resolve } from 'node:path'
import { stat } from 'node:fs/promises'

const rootRequire=createRequire(import.meta.url)
const builderRequire=createRequire(rootRequire.resolve('electron-builder'))
const packageRequire=createRequire(builderRequire.resolve('app-builder-lib'))
const {getCurrentFuseWire,FuseVersion,FuseV1Options}=packageRequire('@electron/fuses')
assert.ok(process.argv[2],'Provide the packaged application or executable')
let application=resolve(process.argv[2])
await stat(application)
if(process.platform==='darwin') {
  while(!application.endsWith('.app')&&dirname(application)!==application) application=dirname(application)
  assert.ok(application.endsWith('.app'),'The macOS executable must belong to an app bundle')
}
const wire=await getCurrentFuseWire(application)
assert.equal(wire.version,FuseVersion.V1,'Unsupported fuse wire version')
// Official V1 wire states are ASCII 0 (disabled) and 1 (enabled).
const expected={RunAsNode:false,EnableNodeOptionsEnvironmentVariable:false,EnableNodeCliInspectArguments:false,OnlyLoadAppFromAsar:true,EnableEmbeddedAsarIntegrityValidation:true}
for(const [name,enabled] of Object.entries(expected)) assert.equal(wire[FuseV1Options[name]],enabled?49:48,`${name} has the wrong fuse state`)
console.log(JSON.stringify({application:basename(application),wireVersion:wire.version,verified:true,values:expected,asarIntegrityRuntimeSupported:['darwin','win32'].includes(process.platform)},null,2))
