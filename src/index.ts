import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'
import { NextMiddleware } from 'next/server'
import { Redis } from '@upstash/redis'
import { createClient } from '@vercel/edge-config'
import { NextMiddlewareResult } from 'next/dist/server/web/types'
import { z } from 'zod'

const MAINTENANCE_KEY_MISSING = 'Maintenance mode key is not set'

type Provider = 'upstash' | 'edge-config'

const MaintenanceModeOptions = z.object({
  provider: z.enum(['upstash', 'edge-config']),
  maintenancePageSlug: z.string().optional(),
  key: z.string().optional(),
})

const MaintenanceModeConfig = z.object({
  middleware: z.function(),
  connectionString: z.string().url(),
  options: MaintenanceModeOptions,
})

type MiddlewareFactoryOptions = Readonly<{
  provider: Provider
  maintenancePageSlug?: string
  key?: string
}>

type MiddlewareHelperArgs = Readonly<{
  req: NextRequest
  _next: NextFetchEvent
  middleware: NextMiddleware
  connectionString: string
  options: MiddlewareFactoryOptions
}>

const validateConfig = (
  middleware: NextMiddleware,
  connectionString: string,
  options: Readonly<MiddlewareFactoryOptions>,
) => {
  try {
    MaintenanceModeConfig.parse({ middleware, connectionString, options })

    if (options.provider === 'upstash' && !connectionString.includes('upstash')) {
      throw new Error("Invalid connection string for provider 'upstash'")
    }

    if (options.provider === 'edge-config' && !connectionString.includes('edge-config')) {
      throw new Error("Invalid connection string for provider 'edge-config'")
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(e.errors ? e.errors[0].message : e.message)
    } else throw e
  }
}

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

const withUpstash = async ({
  req,
  _next,
  middleware,
  connectionString,
  options,
}: MiddlewareHelperArgs): Promise<NextMiddlewareResult> => {
  try {
    const [protocolAndUrl, token] = connectionString.split('@')
    const url = protocolAndUrl
    const redis = new Redis({ url: url, token: token })

    const isInMaintenanceMode = await redis.get<boolean | null>(options?.key || 'isInMaintenanceMode')

    if (isInMaintenanceMode === null) {
      throw new Error(MAINTENANCE_KEY_MISSING)
    }

    if (isInMaintenanceMode) {
      return handleMaintenanceMode(isInMaintenanceMode, options, req)
    }

    return middleware(req, _next)
  } catch (e) {
    if (e instanceof Error) throw new Error(e.message)
  }
}

const withEdgeConfig = async ({
  req,
  _next,
  middleware,
  connectionString,
  options,
}: MiddlewareHelperArgs): Promise<NextMiddlewareResult> => {
  try {
    const edgeConfig = createClient(connectionString)
    const isInMaintenanceMode = await edgeConfig.get<boolean | undefined>(options?.key || 'isInMaintenanceMode')

    if (isInMaintenanceMode === undefined) {
      throw new Error(MAINTENANCE_KEY_MISSING)
    }

    if (isInMaintenanceMode) {
      return handleMaintenanceMode(isInMaintenanceMode, options, req)
    }

    return middleware(req, _next)
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
    validateConfig(middleware, connectionString, options)
    const provider = options?.provider
    if (!connectionString) {
      throw new Error('Connection string is required')
    }
    if (!provider) {
      throw new Error('Provider is required')
    }

    const helperArgs = {
      req,
      _next,
      middleware,
      connectionString,
      options,
    }

    switch (provider) {
      case 'upstash':
        return withUpstash(helperArgs)
      case 'edge-config':
        return withEdgeConfig(helperArgs)
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }
}

export default withMaintenanceMode
