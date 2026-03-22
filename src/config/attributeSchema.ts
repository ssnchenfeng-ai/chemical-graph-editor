export type BaseFieldOption = string | { val: string; label: string };

export interface BaseAttributeField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'select';
  default: string | number;
  options?: BaseFieldOption[];
  appliesTo: 'node' | 'edge' | 'both';
}

export const BASE_ATTRIBUTE_FIELDS: BaseAttributeField[] = [
  { name: 'tag', label: '位号 (Tag)', type: 'string', default: 'New-Tag', appliesTo: 'both' },
  { name: 'desc', label: '描述 (Description)', type: 'string', default: '', appliesTo: 'both' },
  { name: 'spec', label: '规格型号 (Spec)', type: 'string', default: '', appliesTo: 'both' },
  { name: 'material', label: '材质 (Material)', type: 'string', default: 'CS', appliesTo: 'both' },
  { name: 'fluid', label: '介质 (Fluid)', type: 'string', default: 'Water', appliesTo: 'edge' },
];

