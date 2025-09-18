const { z } = require("zod");

// Detail entry (with mouseScolls alias → mouseScrolls)
const detailZ = z.object({
  processName: z.string().min(1),
  title: z.string().optional().default(''),
  activeTime: z.number().nonnegative(),
  idleTime: z.number().nonnegative(),
  mouseMovements: z.number().int().nonnegative(),
  mouseScrolls: z.number().int().nonnegative().optional(),
  mouseScolls: z.number().int().nonnegative().optional(),
  mouseClicks: z.number().int().nonnegative(),
  keysPressed: z.number().int().nonnegative(),
  appName: z.string().optional()
}).transform(d => ({
  ...d,
  mouseScrolls: d.mouseScrolls ?? d.mouseScolls ?? 0
}));

const chunkZ = z.object({
  deviceId: z.string().min(1),
  logClock: z.object({
    clientSideTimeEpochMs: z.number().int().nonnegative(),
    isTimeDirty: z.boolean().optional().default(false)
  }),
  logTotals: z.object({
    activeTime: z.number().nonnegative(),
    idleTime: z.number().nonnegative(),
    mouseMovements: z.number().int().nonnegative(),
    mouseScrolls: z.number().int().nonnegative().optional(),
    mouseScolls: z.number().int().nonnegative().optional(),
    mouseClicks: z.number().int().nonnegative(),
    keysPressed: z.number().int().nonnegative()
  }).transform(t => ({ ...t, mouseScrolls: t.mouseScrolls ?? t.mouseScolls ?? 0 })),
  logDetails: z.array(detailZ).default([])
});

const ingestBodyZ = z.object({
  chunks: z.array(chunkZ).min(1)
});

module.exports = { ingestBodyZ };
