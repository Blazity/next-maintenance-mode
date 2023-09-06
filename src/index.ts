import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'
import { NextMiddleware } from 'next/server'
import { Redis } from '@upstash/redis'
import { createClient } from '@vercel/edge-config'
import { NextMiddlewareResult } from 'next/dist/server/web/types'

enum Provider {
  UPSTASH = 'upstash',
  EDGE_CONFIG = 'edge-config',
}

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

    const isInMaintenanceMode = await redis.get<boolean>(options?.key || 'isInMaintenanceMode')

    if (isInMaintenanceMode === null) {
      await redis.set(options?.key || 'isInMaintenanceMode', 'false')
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
    const isInMaintenanceMode = (await edgeConfig.get<boolean>(options?.key || 'isInMaintenanceMode')) as boolean

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
      case Provider.UPSTASH:
        return withUpstash(helperArgs)
      case Provider.EDGE_CONFIG:
        return withEdgeConfig(helperArgs)
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }
}

module.exports = withMaintenanceMode
