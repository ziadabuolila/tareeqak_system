import { LoaderCircle } from "lucide-react";

export function InlineNumberLoader({ label = "جارٍ تحميل الرقم" }: { label?: string }) {
  return (
    <span className="inline-number-loader" role="status" aria-label={label}>
      <LoaderCircle size={17} aria-hidden="true" />
    </span>
  );
}
