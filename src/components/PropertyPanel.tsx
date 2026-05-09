import type { Node } from '@xyflow/react';

interface PropertyPanelProps {
  node: Node;
  onChange: (data: Record<string, unknown>) => void;
}

function NumberInput({
  label,
  field,
  data,
  onChange,
}: {
  label: string;
  field: string;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  return (
    <div className="prop-field">
      <label className="prop-label">{label}</label>
      <input
        className="prop-input"
        type="number"
        value={(data[field] as number) ?? 0}
        onChange={(e) => onChange({ ...data, [field]: Number(e.target.value) })}
      />
    </div>
  );
}

function TextInput({
  label,
  field,
  data,
  onChange,
}: {
  label: string;
  field: string;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  return (
    <div className="prop-field">
      <label className="prop-label">{label}</label>
      <input
        className="prop-input"
        type="text"
        value={(data[field] as string) ?? ''}
        onChange={(e) => onChange({ ...data, [field]: e.target.value })}
      />
    </div>
  );
}

function CheckboxInput({
  label,
  field,
  data,
  onChange,
}: {
  label: string;
  field: string;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  return (
    <div className="prop-field prop-field-checkbox">
      <label className="prop-label">{label}</label>
      <input
        type="checkbox"
        checked={(data[field] as boolean) ?? false}
        onChange={(e) => onChange({ ...data, [field]: e.target.checked })}
      />
    </div>
  );
}

function SelectInput({
  label,
  field,
  options,
  data,
  onChange,
}: {
  label: string;
  field: string;
  options: string[];
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  return (
    <div className="prop-field">
      <label className="prop-label">{label}</label>
      <select
        className="prop-select"
        value={(data[field] as string) ?? options[0]}
        onChange={(e) => onChange({ ...data, [field]: e.target.value })}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function ColorInput({
  label,
  field,
  data,
  onChange,
}: {
  label: string;
  field: string;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  return (
    <div className="prop-field">
      <label className="prop-label">{label}</label>
      <input
        className="prop-input prop-color"
        type="color"
        value={(data[field] as string) ?? '#000000'}
        onChange={(e) => onChange({ ...data, [field]: e.target.value })}
      />
    </div>
  );
}

function ModifiersInput({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const mods = (data['modifiers'] as Record<string, boolean>) ?? {
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
  };

  const setMod = (key: string, val: boolean) => {
    onChange({ ...data, modifiers: { ...mods, [key]: val } });
  };

  return (
    <div className="prop-modifiers">
      {(['ctrl', 'shift', 'alt', 'meta'] as const).map((k) => (
        <label key={k} className="prop-mod-label">
          <input
            type="checkbox"
            checked={mods[k] ?? false}
            onChange={(e) => setMod(k, e.target.checked)}
          />
          {k.charAt(0).toUpperCase() + k.slice(1)}
        </label>
      ))}
    </div>
  );
}

export function PropertyPanel({ node, onChange }: PropertyPanelProps) {
  const data = node.data as Record<string, unknown>;
  const type = data['type'] as string;

  const renderFields = () => {
    switch (type) {
      case 'move_absolute':
        return (
          <>
            <NumberInput label="X" field="x" data={data} onChange={onChange} />
            <NumberInput label="Y" field="y" data={data} onChange={onChange} />
          </>
        );

      case 'move_relative':
        return (
          <>
            <NumberInput label="ΔX" field="dx" data={data} onChange={onChange} />
            <NumberInput label="ΔY" field="dy" data={data} onChange={onChange} />
          </>
        );

      case 'click':
        return (
          <>
            <NumberInput label="X" field="x" data={data} onChange={onChange} />
            <NumberInput label="Y" field="y" data={data} onChange={onChange} />
            <SelectInput
              label="Button"
              field="button"
              options={['left', 'right', 'middle']}
              data={data}
              onChange={onChange}
            />
            <CheckboxInput label="Double Click" field="double" data={data} onChange={onChange} />
          </>
        );

      case 'key_press':
        return (
          <>
            <TextInput label="Key" field="key" data={data} onChange={onChange} />
            <TextInput label="Code" field="code" data={data} onChange={onChange} />
            <div className="prop-section-title">Modifiers</div>
            <ModifiersInput data={data} onChange={onChange} />
          </>
        );

      case 'wait':
        return (
          <>
            <NumberInput label="Duration (ms)" field="duration" data={data} onChange={onChange} />
          </>
        );

      case 'loop':
        return (
          <>
            <div className="prop-field">
              <label className="prop-label">Count</label>
              <input
                className="prop-input"
                type="text"
                value={String((data['count'] as number | 'infinite') ?? 1)}
                onChange={(e) => {
                  const val = e.target.value === 'infinite' ? 'infinite' : Number(e.target.value);
                  onChange({ ...data, count: val });
                }}
                placeholder="number or 'infinite'"
              />
            </div>
          </>
        );

      case 'pixel_condition':
        return (
          <>
            <NumberInput label="X" field="x" data={data} onChange={onChange} />
            <NumberInput label="Y" field="y" data={data} onChange={onChange} />
            <ColorInput label="Color" field="color" data={data} onChange={onChange} />
            <SelectInput
              label="Operator"
              field="operator"
              options={['==', '!=']}
              data={data}
              onChange={onChange}
            />
          </>
        );

      default:
        return <div className="prop-empty">No editable properties</div>;
    }
  };

  return (
    <div className="property-panel">
      <div className="property-panel-title">{type}</div>
      <div className="property-panel-id">ID: {node.id}</div>
      {renderFields()}
    </div>
  );
}
