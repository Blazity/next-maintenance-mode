"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMaintenanceModeStatus = exports.withMaintenanceMode = void 0;
const server_1 = require("next/server");
const redis_1 = require("@upstash/redis");
const edge_config_1 = require("@vercel/edge-config");
const zod_1 = require("zod");
const typescript_lru_cache_1 = require("typescript-lru-cache");
const DEFAULT_MAINTENANCE_PAGE_SLUG = '/maintenance';
const DEFAULT_MAINTENANCE_MODE_KEY = 'isInMaintenanceMode';
const MAINTENANCE_KEY_MISSING = 'Maintenance mode key is not found in the specified provider';
const MiddlewareConfig = zod_1.z
    .object({
    beforeCheck: zod_1.z.function().optional(),
    afterCheck: zod_1.z.function().optional(),
})
    .refine((data) => data.beforeCheck || data.afterCheck, {
    message: "At least one of 'beforeCheck' or 'afterCheck' middleware functions must be defined",
    path: ['middleware'],
});
const MaintenanceModeOptions = zod_1.z.object({
    provider: zod_1.z.enum(['upstash', 'edge-config']),
    maintenancePageSlug: zod_1.z.string().optional().nullable(),
    key: zod_1.z.string().optional().nullable(),
    cacheTime: zod_1.z.number().optional().nullable(),
});
const MaintenanceModeConfig = zod_1.z
    .object({
    middleware: MiddlewareConfig,
    connectionString: zod_1.z.string(),
    options: MaintenanceModeOptions.required(),
})
    .refine((data) => {
    return ((data.options.provider === 'upstash' && data.connectionString.includes('upstash')) ||
        (data.options.provider === 'edge-config' && data.connectionString.includes('edge-config')));
}, {
    message: 'Invalid connection string for the selected provider',
    path: ['connectionString'],
});
const handleMaintenanceMode = async (isInMaintenanceMode, options, req) => {
    const maintenancePageSlug = options?.maintenancePageSlug ?? DEFAULT_MAINTENANCE_PAGE_SLUG;
    if (isInMaintenanceMode) {
        req.nextUrl.pathname = maintenancePageSlug;
        return server_1.NextResponse.rewrite(req.nextUrl);
    }
    return server_1.NextResponse.next();
};
const getIsInMaintenanceMode = async (options, connectionString, cache) => {
    const provider = options?.provider;
    const key = options?.key ?? DEFAULT_MAINTENANCE_MODE_KEY;
    const cacheKey = `${provider}-${connectionString}-${key}`;
    if (!!cache && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }
    try {
        let result;
        switch (provider) {
            case 'upstash': {
                const [url, token] = connectionString.split('@');
                const redis = new redis_1.Redis({ url: url, token: token });
                result = await redis.get(key);
                break;
            }
            case 'edge-config': {
                const edgeConfig = (0, edge_config_1.createClient)(connectionString);
                result = await edgeConfig.get(key);
                break;
            }
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
        !!cache && cache.set(cacheKey, result);
        return result;
    }
    catch (e) {
        if (e instanceof Error) {
            throw new Error(e.message);
        }
        else {
            throw new Error('Unknown error');
        }
    }
};
const providerMiddleware = async ({ req, _next, middleware, connectionString, options, cache }) => {
    try {
        if (middleware.beforeCheck) {
            const beforeCheckResponse = await middleware.beforeCheck(req, _next);
            if (beforeCheckResponse instanceof server_1.NextResponse) {
                return beforeCheckResponse;
            }
        }
        const isInMaintenanceMode = await getIsInMaintenanceMode(options, connectionString, cache);
        if (isInMaintenanceMode === null || isInMaintenanceMode === undefined) {
            throw new Error(MAINTENANCE_KEY_MISSING);
        }
        if (isInMaintenanceMode) {
            return await handleMaintenanceMode(isInMaintenanceMode, options, req);
        }
        if (middleware.afterCheck) {
            return await middleware.afterCheck(req, _next);
        }
    }
    catch (e) {
        if (e instanceof Error)
            throw new Error(e.message);
        else
            throw new Error('Unknown error');
    }
};
const withMaintenanceMode = ({ beforeCheck, afterCheck }, connectionString, options) => {
    if (!beforeCheck && !afterCheck) {
        throw new Error('At least one function (beforeCheck or afterCheck) should be passed');
    }
    const cacheTime = options?.cacheTime;
    const cache = !!cacheTime
        ? new typescript_lru_cache_1.LRUCache({
            maxSize: 1,
            entryExpirationTimeInMS: cacheTime,
        })
        : undefined;
    return async (req, _next) => {
        const parseResult = MaintenanceModeConfig.safeParse({
            middleware: { beforeCheck, afterCheck },
            connectionString,
            options,
        });
        if (!parseResult.success)
            throw new Error(parseResult.error.message);
        return providerMiddleware({
            req,
            _next,
            middleware: { beforeCheck, afterCheck },
            connectionString,
            options,
            cache,
        });
    };
};
exports.withMaintenanceMode = withMaintenanceMode;
const ToggleOptionsSchema = zod_1.z
    .object({
    provider: zod_1.z.enum(['upstash', 'edge-config']),
    connectionString: zod_1.z.string(),
    key: zod_1.z.string().optional(),
    maintenanceEdgeConfigId: zod_1.z.string().optional(),
    maintenanceModeVercelApiToken: zod_1.z.string().optional(),
})
    .refine((data) => {
    return ((data.provider === 'upstash' && data.connectionString.includes('upstash')) ||
        (data.provider === 'edge-config' && data.connectionString.includes('edge-config')));
}, {
    message: 'Invalid connection string for the selected provider',
    path: ['connectionString'],
})
    .refine((data) => {
    if (data.provider === 'edge-config') {
        return !!data.maintenanceEdgeConfigId && !!data.maintenanceModeVercelApiToken;
    }
    return true;
}, {
    message: 'Missing maintenanceEdgeConfigId or maintenanceModeVercelApiToken',
    path: ['maintenanceEdgeConfigId', 'maintenanceModeVercelApiToken'],
});
const updateMaintenanceModeStatus = async (isActive, options) => {
    try {
        const parseResult = ToggleOptionsSchema.safeParse(options);
        if (!parseResult.success)
            throw new Error(parseResult.error.message);
        const { provider, connectionString, key, maintenanceEdgeConfigId, maintenanceModeVercelApiToken } = parseResult.data;
        switch (provider) {
            case 'upstash': {
                const [url, token] = connectionString.split('@');
                const redis = new redis_1.Redis({ url: url, token: token });
                await redis.set(key ?? DEFAULT_MAINTENANCE_MODE_KEY, isActive);
                break;
            }
            case 'edge-config': {
                const res = await fetch(`https://api.vercel.com/v1/edge-config/${maintenanceEdgeConfigId}/items`, {
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
                });
                if (res.status !== 200)
                    throw new Error(`${res.status} - ${res.statusText}`);
                break;
            }
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }
    catch (e) {
        if (e instanceof Error) {
            throw new Error(e.message);
        }
        else {
            throw new Error('Unknown error');
        }
    }
};
exports.updateMaintenanceModeStatus = updateMaintenanceModeStatus;
