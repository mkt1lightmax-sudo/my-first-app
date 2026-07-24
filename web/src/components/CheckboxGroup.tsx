export default function CheckboxGroup<T extends string>({
  value,
  onChange,
  options,
  labels,
}: {
  value: T[];
  onChange: (value: T[]) => void;
  options: readonly T[];
  labels: Record<T, string>;
}) {
  function toggle(opt: T) {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} />
          {labels[opt]}
        </label>
      ))}
    </div>
  );
}
