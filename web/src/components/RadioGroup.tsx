export default function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  labels,
  allowEmpty,
}: {
  name: string;
  value: T | "";
  onChange: (value: T) => void;
  options: readonly T[];
  labels: Record<T, string>;
  allowEmpty?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {allowEmpty && (
        <label className="flex items-center gap-1.5 text-sm text-gray-500">
          <input type="radio" name={name} checked={value === ""} onChange={() => onChange("" as T)} />
          ไม่ระบุ
        </label>
      )}
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="radio" name={name} checked={value === opt} onChange={() => onChange(opt)} />
          {labels[opt]}
        </label>
      ))}
    </div>
  );
}
