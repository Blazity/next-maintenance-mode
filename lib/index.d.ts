import { NextFetchEvent, NextRequest } from 'next/server';
import { NextMiddleware } from 'next/server';
import { NextMiddlewareResult } from 'next/dist/server/web/types';
import { z } from 'zod';
declare type Provider = 'upstash' | 'edge-config';
declare type MiddlewareFactoryOptions = Readonly<{
    provider: Provider;
    maintenancePageSlug?: string;
    key?: string;
    cacheTime?: number;
}>;
declare const withMaintenanceMode: ({ beforeCheck, afterCheck }: {
    beforeCheck?: NextMiddleware | undefined;
    afterCheck?: NextMiddleware | undefined;
}, connectionString: string, options: MiddlewareFactoryOptions) => (req: NextRequest, _next: NextFetchEvent) => Promise<NextMiddlewareResult>;
declare const ToggleOptionsSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    provider: z.ZodEnum<["upstash", "edge-config"]>;
    connectionString: z.ZodString;
    key: z.ZodOptional<z.ZodString>;
    maintenanceEdgeConfigId: z.ZodOptional<z.ZodString>;
    maintenanceModeVercelApiToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provider: "upstash" | "edge-config";
    connectionString: string;
    key?: string | undefined;
    maintenanceEdgeConfigId?: string | undefined;
    maintenanceModeVercelApiToken?: string | undefined;
}, {
    provider: "upstash" | "edge-config";
    connectionString: string;
    key?: string | undefined;
    maintenanceEdgeConfigId?: string | undefined;
    maintenanceModeVercelApiToken?: string | undefined;
}>, {
    provider: "upstash" | "edge-config";
    connectionString: string;
    key?: string | undefined;
    maintenanceEdgeConfigId?: string | undefined;
    maintenanceModeVercelApiToken?: string | undefined;
}, {
    provider: "upstash" | "edge-config";
    connectionString: string;
    key?: string | undefined;
    maintenanceEdgeConfigId?: string | undefined;
    maintenanceModeVercelApiToken?: string | undefined;
}>, {
    provider: "upstash" | "edge-config";
    connectionString: string;
    key?: string | undefined;
    maintenanceEdgeConfigId?: string | undefined;
    maintenanceModeVercelApiToken?: string | undefined;
}, {
    provider: "upstash" | "edge-config";
    connectionString: string;
    key?: string | undefined;
    maintenanceEdgeConfigId?: string | undefined;
    maintenanceModeVercelApiToken?: string | undefined;
}>;
declare type ToggleOptions = z.infer<typeof ToggleOptionsSchema>;
declare const updateMaintenanceModeStatus: (isActive: boolean, options: ToggleOptions) => Promise<void>;
export { withMaintenanceMode, updateMaintenanceModeStatus };
