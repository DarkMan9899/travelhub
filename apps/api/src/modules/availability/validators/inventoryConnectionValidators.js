/**
 * Zod validators for the Connectivity Platform surface (Phase 17
 * §15-28) — Layer 2 structural validation only, mirrors
 * `availabilityValidators.js`'s conventions exactly.
 */

import { z } from 'zod';
import {
  CONNECTOR_TYPES,
  CONNECTION_DIRECTIONS,
} from '../services/inventoryConnectionService.js';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();

export const createConnectionSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    partnerId: z.coerce.number().int().positive(),
    listingId: z.coerce.number().int().positive().optional(),
    connectorType: z.enum(CONNECTOR_TYPES),
    direction: z.enum(CONNECTION_DIRECTIONS),
    name: z.string().min(1).max(150),
    config: z.record(z.string(), z.any()).optional(),
  }),
});

export const connectionIdParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.any(),
});

export const updateConnectionSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    config: z.record(z.string(), z.any()).optional(),
    status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  }),
});

export const listConnectionsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({ partnerId: z.coerce.number().int().positive() }),
  body: z.any(),
});

export const setMappingSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.object({
    externalResourceId: z.string().max(150).optional(),
    externalResourceName: z.string().max(200).optional(),
    bookableUnitId: z.coerce.number().int().positive(),
  }),
});

export const resolveConflictSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    conflictId: z.coerce.number().int().positive(),
  }),
  query: passthroughQuery,
  body: z.object({ resolutionNote: z.string().max(500).optional() }),
});

export const exportTokenParamsSchema = z.object({
  params: z.object({ token: z.string().min(1) }),
  query: passthroughQuery,
  body: z.any(),
});
