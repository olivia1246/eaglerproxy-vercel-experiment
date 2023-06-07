const f = Object.freeze

// bridge meta
export const BRIDGE_VERSION: Readonly<number> = f(1)

// adapter meta
export const PROXY_BRANDING: Readonly<string> = f("EaglercraftXBungee")
export const PROXY_VERSION: Readonly<string> = f("1.0.6")

export const NETWORK_VERSION: Readonly<number> = f(0x03)
export const VANILLA_PROTOCOL_VERSION: Readonly<number> = f(47)