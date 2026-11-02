import type { ProviderConfig } from './contracts'

/** A saved credential belongs to an explicit endpoint and protocol, not merely a UI row. */
export function providerDestinationChanged(
  previous: ProviderConfig | undefined,
  next: ProviderConfig,
): boolean {
  if (!previous) return false
  const canonical = (value: string) => new URL(value).href.replace(/\/+$/, '')
  return (
    previous.protocol !== next.protocol || canonical(previous.baseUrl) !== canonical(next.baseUrl)
  )
}
