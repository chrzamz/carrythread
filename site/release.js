// Root updates this only after the release audit. Do not invent artifact URLs.
export const release = Object.freeze({
  version: '0.1.0',
  stage: 'released', // 'pre-release' | 'released'
  repository: 'https://github.com/chrzamz/carrythread',
  releases: 'https://github.com/chrzamz/carrythread/releases',
  latest: 'https://github.com/chrzamz/carrythread/releases/latest',
});
