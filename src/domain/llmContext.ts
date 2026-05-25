import type { DomainModel, Pipe, Port } from './model';
import type { ValidationIssue } from './validators';

const value = (input: unknown, fallback = '-') => {
  if (input === undefined || input === null || input === '') return fallback;
  return String(input);
};

const tableRow = (items: unknown[]) => `| ${items.map((item) => value(item).replace(/\|/g, '/')).join(' | ')} |`;

const portIndex = (model: DomainModel) => new Map(model.ports.map((port) => [port.id, port]));

const ownerLabel = (model: DomainModel, port?: Port) => {
  if (!port) return '-';
  const equipment = model.equipments.find((item) => item.id === port.ownerId);
  if (equipment) return `${equipment.tag || equipment.id}.${port.label || port.id}`;
  const instrument = model.instruments.find((item) => item.id === port.ownerId);
  if (instrument) return `${instrument.tag || instrument.id}.${port.label || port.id}`;
  const zone = model.zones.find((item) => item.id === port.ownerId);
  if (zone) {
    const parent = model.equipments.find((item) => item.id === zone.equipmentId);
    return `${parent?.tag || zone.equipmentId}.${zone.label || zone.role}.${port.label || port.id}`;
  }
  return `${port.ownerId}.${port.label || port.id}`;
};

const pipeEndpoint = (model: DomainModel, pipe: Pipe, endpoint: 'from' | 'to') => {
  const ports = portIndex(model);
  return ownerLabel(model, ports.get(endpoint === 'from' ? pipe.fromPortId : pipe.toPortId));
};

export const renderDomainModelMarkdown = (model: DomainModel, issues: ValidationIssue[] = []) => {
  const lines: string[] = [];
  lines.push(`# ${model.drawing.id} ${model.drawing.name}`);
  lines.push('');
  lines.push('## 摘要');
  lines.push(`- 设备：${model.equipments.length}`);
  lines.push(`- 仪表：${model.instruments.length}`);
  lines.push(`- 管线：${model.pipes.length}`);
  lines.push(`- 端口：${model.ports.length}`);
  lines.push(`- 腔室：${model.zones.length}`);
  lines.push(`- 内部部件：${(model.internalParts || []).length}`);
  lines.push(`- 内部关系：${(model.internalConnections || []).length}`);
  lines.push('');

  lines.push('## 设备');
  if (model.equipments.length === 0) {
    lines.push('- 暂无设备');
  } else {
    lines.push(tableRow(['位号', '类型', '名称/描述', '腔室', '端口']));
    lines.push(tableRow(['---', '---', '---', '---', '---']));
    model.equipments.forEach((item) => {
      const zones = item.zoneIds
        .map((id) => model.zones.find((zone) => zone.id === id))
        .filter(Boolean)
        .map((zone) => zone?.label || zone?.role)
        .join(', ');
      const ports = item.portIds
        .map((id) => model.ports.find((port) => port.id === id))
        .filter(Boolean)
        .map((port) => `${port?.label || port?.id}(${port?.direction || 'bi'})`)
        .join(', ');
      lines.push(tableRow([item.tag || item.id, item.type, item.description || item.name, zones, ports]));
      const internalParts = (model.internalParts || []).filter((part) => part.equipmentId === item.id);
      const internalConnections = (model.internalConnections || []).filter((connection) => connection.equipmentId === item.id);
      if (internalParts.length > 0) {
        lines.push(`  - 内部部件：${internalParts.map((part) => `${part.label || part.id}(${part.type})`).join(' -> ')}`);
      }
      if (internalConnections.length > 0) {
        lines.push(`  - 内部关系：${internalConnections.map((connection) => `${connection.sourceId.split('.internal.')[1]} -${connection.type}-> ${connection.targetId.split('.internal.')[1]}`).join('; ')}`);
      }
    });
  }
  lines.push('');

  lines.push('## 管线');
  if (model.pipes.length === 0) {
    lines.push('- 暂无管线');
  } else {
    lines.push(tableRow(['管线号', '起点', '终点', '介质', 'DN', 'PN', '材质', '保温/伴热']));
    lines.push(tableRow(['---', '---', '---', '---', '---', '---', '---', '---']));
    model.pipes.forEach((pipe) => {
      lines.push(tableRow([
        pipe.tag || pipe.id,
        pipeEndpoint(model, pipe, 'from'),
        pipeEndpoint(model, pipe, 'to'),
        pipe.fluid,
        pipe.dnSpec?.value,
        pipe.pnSpec?.value,
        pipe.material,
        pipe.insulation,
      ]));
    });
  }
  lines.push('');

  lines.push('## 仪表');
  if (model.instruments.length === 0) {
    lines.push('- 暂无仪表');
  } else {
    lines.push(tableRow(['位号', '类型', '回路号', '属性']));
    lines.push(tableRow(['---', '---', '---', '---']));
    model.instruments.forEach((item) => {
      lines.push(tableRow([item.tag || item.id, item.type, item.loop, JSON.stringify(item.attributes || {})]));
    });
  }
  lines.push('');

  lines.push('## 检查结果');
  if (issues.length === 0) {
    lines.push('- 未发现基础问题');
  } else {
    issues.forEach((issue) => {
      lines.push(`- ${issue.level.toUpperCase()} ${issue.code}: ${issue.message}`);
    });
  }
  lines.push('');

  lines.push('## 原则');
  lines.push('- 本 Markdown 是从结构化 DomainModel 自动生成的 LLM 读取视图，不作为唯一源数据。');
  lines.push('- 如需精确推理，应优先读取同一时刻导出的 semantic JSON。');

  return lines.join('\n');
};
