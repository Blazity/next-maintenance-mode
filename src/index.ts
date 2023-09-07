import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'
import { NextMiddleware } from 'next/server'
import { Redis } from '@upstash/redis'
import { createClient } from '@vercel/edge-config'
import { NextMiddlewareResult } from 'next/dist/server/web/types'
import { z } from 'zod'

const MAINTENANCE_KEY_MISSING = 'Maintenance mode key is not set'

type Provider = 'upstash' | 'edge-config'

type MiddlewareFactoryOptions = Readonly<{
  provider: Provider
  maintenancePageSlug?: string
  key?: string
}>

type ProviderMiddleware = Readonly<{
  req: NextRequest
  _next: NextFetchEvent
  middleware: NextMiddleware
  connectionString: string
  options: MiddlewareFactoryOptions
}>

const MaintenanceModeOptions = z.object({
  provider: z.enum(['upstash', 'edge-config']),
  maintenancePageSlug: z.string().optional(),
  key: z.string().optional(),
})

const MaintenanceModeConfig = z
  .object({
    middleware: z.function(),
    connectionString: z.string(),
    options: MaintenanceModeOptions.required(),
  })
  .refine(
    (data) => {
      return (
        (data.options.provider === 'upstash' && data.connectionString.includes('upstash')) ||
        (data.options.provider === 'edge-config' && data.connectionString.includes('edge-config'))
      )
    },
    {
      message: 'Invalid connection string for the selected provider',
      path: ['connectionString'],
    },
  )

const handleMaintenanceMode = async (
  isInMaintenanceMode: boolean | null,
  options: MiddlewareFactoryOptions,
  req: NextRequest,
): Promise<NextMiddlewareResult> => {
  const maintenancePageSlug = options?.maintenancePageSlug || '/maintenance'
  if (isInMaintenanceMode) {
    req.nextUrl.pathname = maintenancePageSlug
    return NextResponse.rewrite(req.nextUrl)
  }
  return NextResponse.next()
}

const getIsInMaintenanceMode = async (
  provider: Provider,
  connectionString: string,
  key?: string,
): Promise<boolean | null | undefined> => {
  try {
    switch (provider) {
      case 'upstash': {
        const [protocolAndUrl, token] = connectionString.split('@')
        const url = protocolAndUrl
        const redis = new Redis({ url: url, token: token })

        return redis.get<boolean | null>(key || 'isInMaintenanceMode')
      }
      case 'edge-config': {
        const edgeConfig = createClient(connectionString)

        return edgeConfig.get<boolean | undefined>(key || 'isInMaintenanceMode')
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  } catch (e) {
    if (e instanceof Error) throw new Error(e.message)
  }
}

const providerMiddleware = async ({ req, _next, middleware, connectionString, options }: ProviderMiddleware) => {
  try {
    const isInMaintenanceMode = await getIsInMaintenanceMode(options.provider, connectionString, options.key)

    if (isInMaintenanceMode === null || isInMaintenanceMode === undefined) {
      throw new Error(MAINTENANCE_KEY_MISSING)
    }

    return handleMaintenanceMode(isInMaintenanceMode, options, req) ?? middleware(req, _next)
  } catch (e) {
    if (e instanceof Error) throw new Error(e.message)
  }
}

export const withMaintenanceMode = (
  middleware: NextMiddleware,
  connectionString: string,
  options: MiddlewareFactoryOptions,
) => {
  return async (req: NextRequest, _next: NextFetchEvent): Promise<NextMiddlewareResult> => {
    const parseResult = MaintenanceModeConfig.safeParse({
      middleware,
      connectionString,
      options,
    })
    if (!parseResult.success) throw new Error(parseResult.error.message)
    return providerMiddleware({
      req,
      _next,
      middleware,
      connectionString,
      options,
    })
  }
}

export default withMaintenanceMode
