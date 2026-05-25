#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const serverInfo = { name: 'pid-context-server', version: '0.1.0' };
const repoRoot = path.resolve(process.env.PID_CONTEXT_ROOT || path.join(path.dirname(new URL(import.meta.url).pathname), '../../../../..'));
const drawingsDir = path.resolve(process.env.PID_DRAWINGS_DIR || path.join(repoRoot, 'drawings'));

const tools = [
  {
    name: 'list_drawings',
    description: 'List available P&ID drawing documents.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_drawing_summary',
    description: 'Return a compact summary of one P&ID drawing.',
    inputSchema: {
      type: 'object',
      properties: { drawingId: { type: 'string' } },
      required: ['drawingId'],
    },
  },
  {
    name: 'get_equipment',
    description: 'Return one equipment item by id, tag, or name, plus directly related semantic context.',
    inputSchema: {
      type: 'object',
      properties: {
        drawingId: { type: 'string' },
        tag: { type: 'string' },
      },
      required: ['drawingId', 'tag'],
    },
  },
  {
    name: 'export_llm_context',
    description: 'Export a Markdown context pack for a P&ID drawing.',
    inputSchema: {
      type: 'object',
      properties: {
        drawingId: { type: 'string' },
        scope: { type: 'string', description: 'Optional equipment tag, loop, or whole drawing scope.' },
      },
      required: ['drawingId'],
    },
  },
];

const send = (message) => {
  process.stdout.write(`${JSON.stringify(message)}\n`);
};

const textResult = (text) => ({
  content: [{ type: 'text', text }],
});

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const listDrawingFiles = async () => {
  const entries = await fs.readdir(drawingsDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && /\.(pid|ir)?\.?json$/i.test(entry.name))
    .map((entry) => path.join(drawingsDir, entry.name));
};

const normalizeDocument = (raw, filePath) => {
  const semantic = raw.semantic || raw.ir || (raw.meta?.version && raw.model ? raw : undefined);
  const model = semantic?.model || raw.model;
  if (!model?.drawing) {
    throw new Error(`No SemanticIR model found in ${filePath}`);
  }

  return {
    filePath,
    meta: raw.meta || semantic?.meta || {},
    canvas: raw.canvas,
    semantic: semantic || { meta: raw.meta || {}, model },
    model,
  };
};

const loadDrawing = async (drawingId) => {
  const files = await listDrawingFiles();
  for (const filePath of files) {
    const raw = await readJson(filePath);
    const doc = normalizeDocument(raw, filePath);
    const id = doc.model.drawing.id || path.basename(filePath, path.extname(filePath));
    const name = doc.model.drawing.name || id;
    if (drawingId === id || drawingId === name || drawingId === path.basename(filePath)) {
      return doc;
    }
  }
  throw new Error(`Drawing not found: ${drawingId}`);
};

const indexModel = (model) => {
  const ports = new Map((model.ports || []).map((item) => [item.id, item]));
  const zones = new Map((model.zones || []).map((item) => [item.id, item]));
  const pipes = new Map((model.pipes || []).map((item) => [item.id, item]));
  const instruments = new Map((model.instruments || []).map((item) => [item.id, item]));
  const equipments = new Map((model.equipments || []).map((item) => [item.id, item]));
  return { ports, zones, pipes, instruments, equipments };
};

const equipmentLabel = (item) => item.tag || item.name || item.id;

const summarizeDrawing = (doc) => {
  const model = doc.model;
  const drawing = model.drawing;
  const lines = [
    `# ${drawing.name || drawing.id}`,
    '',
    `- Drawing ID: ${drawing.id}`,
    `- Equipments: ${(model.equipments || []).length}`,
    `- Zones: ${(model.zones || []).length}`,
    `- Ports: ${(model.ports || []).length}`,
    `- Pipes: ${(model.pipes || []).length}`,
    `- Instruments: ${(model.instruments || []).length}`,
    `- Relations: ${(model.relations || []).length}`,
  ];

  if ((model.equipments || []).length > 0) {
    lines.push('', '## Equipment');
    for (const item of model.equipments || []) {
      lines.push(`- ${equipmentLabel(item)}: ${item.type}${item.description ? `, ${item.description}` : ''}`);
    }
  }

  if ((model.pipes || []).length > 0) {
    lines.push('', '## Pipes');
    for (const pipe of model.pipes || []) {
      lines.push(`- ${pipe.tag || pipe.id}: ${pipe.fromPortId} -> ${pipe.toPortId}${pipe.fluid ? `, fluid=${pipe.fluid}` : ''}`);
    }
  }

  return lines.join('\n');
};

const getEquipmentContext = (doc, tag) => {
  const model = doc.model;
  const idx = indexModel(model);
  const equipment = (model.equipments || []).find((item) => [item.id, item.tag, item.name].filter(Boolean).includes(tag));
  if (!equipment) {
    throw new Error(`Equipment not found: ${tag}`);
  }

  const zones = (equipment.zoneIds || []).map((id) => idx.zones.get(id)).filter(Boolean);
  const ownedPorts = (model.ports || []).filter((port) => {
    if ((equipment.portIds || []).includes(port.id)) return true;
    if (port.ownerKind === 'equipment' && port.ownerId === equipment.id) return true;
    if (port.ownerKind === 'zone') {
      const zone = idx.zones.get(port.ownerId);
      return zone?.equipmentId === equipment.id;
    }
    return false;
  });
  const portIds = new Set(ownedPorts.map((port) => port.id));
  const pipes = (model.pipes || []).filter((pipe) => portIds.has(pipe.fromPortId) || portIds.has(pipe.toPortId));
  const instruments = (model.instruments || []).filter((inst) =>
    [inst.mountPortId, inst.measurePortId, inst.controlPortId].some((portId) => portId && portIds.has(portId)),
  );
  const relations = (model.relations || []).filter((rel) =>
    [rel.source?.id, rel.target?.id].includes(equipment.id)
    || ownedPorts.some((port) => [rel.source?.id, rel.target?.id].includes(port.id))
    || zones.some((zone) => [rel.source?.id, rel.target?.id].includes(zone.id)),
  );

  return { equipment, zones, ports: ownedPorts, pipes, instruments, relations };
};

const renderContextPack = (doc, scope) => {
  const model = doc.model;
  const lines = [summarizeDrawing(doc)];

  const scopedEquipment = scope
    ? (model.equipments || []).find((item) => [item.id, item.tag, item.name].filter(Boolean).includes(scope))
    : undefined;

  if (scopedEquipment) {
    const ctx = getEquipmentContext(doc, scope);
    lines.push('', `## Focus: ${equipmentLabel(ctx.equipment)}`, '', '```json', JSON.stringify(ctx, null, 2), '```');
  } else {
    lines.push('', '## Semantic IR', '', '```json', JSON.stringify(model, null, 2), '```');
  }

  return lines.join('\n');
};

const callTool = async (name, args = {}) => {
  if (name === 'list_drawings') {
    const files = await listDrawingFiles();
    const drawings = [];
    for (const filePath of files) {
      const raw = await readJson(filePath);
      const doc = normalizeDocument(raw, filePath);
      drawings.push({
        id: doc.model.drawing.id,
        name: doc.model.drawing.name,
        file: path.relative(repoRoot, filePath),
      });
    }
    return textResult(JSON.stringify(drawings, null, 2));
  }

  if (name === 'get_drawing_summary') {
    return textResult(summarizeDrawing(await loadDrawing(args.drawingId)));
  }

  if (name === 'get_equipment') {
    return textResult(JSON.stringify(getEquipmentContext(await loadDrawing(args.drawingId), args.tag), null, 2));
  }

  if (name === 'export_llm_context') {
    return textResult(renderContextPack(await loadDrawing(args.drawingId), args.scope));
  }

  throw new Error(`Unknown tool: ${name}`);
};

const handle = async (message) => {
  if (message.method === 'initialize') {
    return {
      protocolVersion: message.params?.protocolVersion || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo,
    };
  }
  if (message.method === 'notifications/initialized') return undefined;
  if (message.method === 'tools/list') return { tools };
  if (message.method === 'tools/call') return callTool(message.params?.name, message.params?.arguments || {});
  throw new Error(`Unsupported method: ${message.method}`);
};

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
    const result = await handle(message);
    if (message.id !== undefined && result !== undefined) {
      send({ jsonrpc: '2.0', id: message.id, result });
    }
  } catch (error) {
    if (message?.id !== undefined) {
      send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32000, message: error instanceof Error ? error.message : String(error) },
      });
    }
  }
});
