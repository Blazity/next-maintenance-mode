import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'
import { NextMiddleware } from 'next/server'
import { Redis } from '@upstash/redis'
import { createClient } from '@vercel/edge-config'
import { NextMiddlewareResult } from 'next/dist/server/web/types'
import { z } from 'zod'
import { LRUCache } from 'typescript-lru-cache'

const DEFAULT_MAINTENANCE_PAGE_SLUG = '/maintenance'
const DEFAULT_MAINTENANCE_MODE_KEY = 'isInMaintenanceMode'
const DEFAULT_CACHE_TIME = 60000

const MAINTENANCE_KEY_MISSING = 'Maintenance mode key is not found in the specified provider'

type Provider = 'upstash' | 'edge-config'

type MiddlewareFactoryOptions = Readonly<{
  provider: Provider
  maintenancePageSlug?: string
  key?: string
  cacheTime?: number
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
  cache?: LRUCache<string>
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
  maintenancePageSlug: z.string().optional().nullable(),
  key: z.string().optional().nullable(),
  cacheTime: z.number().optional().nullable(),
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
  const maintenancePageSlug = options?.maintenancePageSlug ?? DEFAULT_MAINTENANCE_PAGE_SLUG
  if (isInMaintenanceMode) {
    req.nextUrl.pathname = maintenancePageSlug
    return NextResponse.rewrite(req.nextUrl)
  }
  return NextResponse.next()
}

const getIsInMaintenanceMode = async (
  options: MiddlewareFactoryOptions,
  connectionString: string,
  cache?: LRUCache<string>,
): Promise<boolean | null | undefined> => {
  const provider = options?.provider
  const key = options?.key ?? DEFAULT_MAINTENANCE_MODE_KEY
  const cacheKey = `${provider}-${connectionString}-${key}`

  if (!!cache && cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  try {
    let result: boolean | null | undefined

    switch (provider) {
      case 'upstash': {
        const [url, token] = connectionString.split('@')
        const redis = new Redis({ url: url, token: token })

        result = await redis.get<boolean | null>(key)
        break
      }
      case 'edge-config': {
        const edgeConfig = createClient(connectionString)

        result = await edgeConfig.get<boolean | undefined>(key)
        break
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    !!cache && cache.set(cacheKey, result)
    return result
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(e.message)
    } else {
      throw new Error('Unknown error')
    }
  }
}

const providerMiddleware = async ({ req, _next, middleware, connectionString, options, cache }: ProviderMiddleware) => {
  try {
    if (middleware.beforeCheck) {
      const beforeCheckResult = await middleware.beforeCheck(req, _next)
      if (beforeCheckResult) return beforeCheckResult
    }

    const isInMaintenanceMode = await getIsInMaintenanceMode(options, connectionString, cache)

    if (isInMaintenanceMode === null || isInMaintenanceMode === undefined) {
      throw new Error(MAINTENANCE_KEY_MISSING)
    }

    const maintenanceResult = await handleMaintenanceMode(isInMaintenanceMode, options, req)

    if (middleware.afterCheck) {
      const afterCheckResult = await middleware.afterCheck(req, _next)
      if (afterCheckResult) return afterCheckResult
    }

    return maintenanceResult
  } catch (e) {
    if (e instanceof Error) throw new Error(e.message)
    else throw new Error('Unknown error')
  }
}

const withMaintenanceMode = (
  { beforeCheck, afterCheck }: { beforeCheck?: NextMiddleware; afterCheck?: NextMiddleware },
  connectionString: string,
  options: MiddlewareFactoryOptions,
) => {
  if (!beforeCheck && !afterCheck) {
    throw new Error('At least one function (beforeCheck or afterCheck) should be passed')
  }
  const cacheTime = options?.cacheTime
  const cache = !!cacheTime
    ? new LRUCache({
        maxSize: 1,
        entryExpirationTimeInMS: cacheTime ?? DEFAULT_CACHE_TIME,
      })
    : undefined
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
      cache,
    })
  }
}

const ToggleOptionsSchema = z
  .object({
    provider: z.enum(['upstash', 'edge-config']),
    connectionString: z.string(),
    key: z.string().optional(),
    maintenanceEdgeConfigId: z.string().optional(),
    maintenanceModeVercelApiToken: z.string().optional(),
  })
  .refine(
    (data) => {
      return (
        (data.provider === 'upstash' && data.connectionString.includes('upstash')) ||
        (data.provider === 'edge-config' && data.connectionString.includes('edge-config'))
      )
    },
    {
      message: 'Invalid connection string for the selected provider',
      path: ['connectionString'],
    },
  )
  .refine(
    (data) => {
      return data.provider === 'edge-config' && !!data.maintenanceEdgeConfigId && !!data.maintenanceModeVercelApiToken
    },
    {
      message: 'Missing maintenanceEdgeConfigId or maintenanceModeVercelApiToken',
      path: ['maintenanceEdgeConfigId', 'maintenanceModeVercelApiToken'],
    },
  )

type ToggleOptions = z.infer<typeof ToggleOptionsSchema>

const updateMaintenanceModeStatus = async (isActive: boolean, options: ToggleOptions) => {
  try {
    const parseResult = ToggleOptionsSchema.safeParse(options)
    if (!parseResult.success) throw new Error(parseResult.error.message)
    const { provider, connectionString, key, maintenanceEdgeConfigId, maintenanceModeVercelApiToken } = parseResult.data

    switch (provider) {
      case 'upstash': {
        const [url, token] = connectionString.split('@')
        const redis = new Redis({ url: url, token: token })
        await redis.set<boolean | null>(key ?? DEFAULT_MAINTENANCE_MODE_KEY, isActive)
        break
      }
      case 'edge-config': {
        await fetch(`https://api.vercel.com/v1/edge-config/${maintenanceEdgeConfigId}/items`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${maintenanceModeVercelApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              {
                operation: 'update',
                key: key ?? DEFAULT_MAINTENANCE_MODE_KEY,
                value: isActive,
              },
            ],
          }),
        })
        break
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

export { withMaintenanceMode, updateMaintenanceModeStatus }
