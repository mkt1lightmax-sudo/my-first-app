import type { ReactNode } from "react";

export default function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <h2 className="mb-3 font-medium text-gray-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
