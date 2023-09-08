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
  middleware: {
    beforeCheck?: NextMiddleware
    afterCheck?: NextMiddleware
  }
  connectionString: string
  options: MiddlewareFactoryOptions
}>

const MiddlewareConfig = z
  .object({
    beforeCheck: z.function().optional(),
    afterCheck: z.function().optional(),
  })
  .refine((data) => data.beforeCheck || data.afterCheck, {
    message: "At least one of 'beforeCheck' or 'afterCheck' middleware functions must be defined",
    path: ['middleware'],
  })

const MaintenanceModeOptions = z.object({
  provider: z.enum(['upstash', 'edge-config']),
  maintenancePageSlug: z.string().optional(),
  key: z.string().optional(),
})

const MaintenanceModeConfig = z
  .object({
    middleware: MiddlewareConfig,
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
        const [url, token] = connectionString.split('@')
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
    if (e instanceof Error) {
      throw new Error(e.message)
    } else {
      throw new Error('Unknown error')
    }
  }
}

const providerMiddleware = async ({ req, _next, middleware, connectionString, options }: ProviderMiddleware) => {
  try {
    if (middleware.beforeCheck) {
      const beforeCheckResult = await middleware.beforeCheck(req, _next)
      if (beforeCheckResult) return beforeCheckResult
    }

    const isInMaintenanceMode = await getIsInMaintenanceMode(options.provider, connectionString, options.key)
    console.log('isInMaintenanceMode')

    if (isInMaintenanceMode === null || isInMaintenanceMode === undefined) {
      throw new Error(MAINTENANCE_KEY_MISSING)
    }

    const maintenanceResult = await handleMaintenanceMode(isInMaintenanceMode, options, req)

    if (middleware.afterCheck) {
      const afterCheckResult = await middleware.afterCheck(req, _next)
      if (afterCheckResult) return afterCheckResult
    }

    return maintenanceResult ?? NextResponse.next()
  } catch (e) {
    if (e instanceof Error) throw new Error(e.message)
    else throw new Error('Unknown error')
  }
}

export const withMaintenanceMode = (
  { beforeCheck, afterCheck }: { beforeCheck?: NextMiddleware; afterCheck?: NextMiddleware },
  connectionString: string,
  options: MiddlewareFactoryOptions,
) => {
  if (!beforeCheck && !afterCheck) {
    throw new Error('At least one function (beforeCheck or afterCheck) should be passed')
  }

  return async (req: NextRequest, _next: NextFetchEvent): Promise<NextMiddlewareResult> => {
    const parseResult = MaintenanceModeConfig.safeParse({
      middleware: { beforeCheck, afterCheck },
      connectionString,
      options,
    })
    if (!parseResult.success) throw new Error(parseResult.error.message)
    return providerMiddleware({
      req,
      _next,
      middleware: { beforeCheck, afterCheck },
      connectionString,
      options,
    })
  }
}

export default withMaintenanceMode
