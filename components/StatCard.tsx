import { cn } from "@/lib/utils";

const colorMap: Record<
  NonNullable<StatCardProps["color"]>,
  { bg: string; iconBg: string; icon: string; value: string }
> = {
  blue:   { bg: "bg-blue-50/60",   iconBg: "bg-blue-100",   icon: "text-blue-600",   value: "text-blue-900" },
  yellow: { bg: "bg-yellow-50/60", iconBg: "bg-yellow-100", icon: "text-yellow-600", value: "text-yellow-900" },
  orange: { bg: "bg-orange-50/60", iconBg: "bg-orange-100", icon: "text-orange-600", value: "text-orange-900" },
  green:  { bg: "bg-green-50/60",  iconBg: "bg-green-100",  icon: "text-green-600",  value: "text-green-900" },
  red:    { bg: "bg-red-50/60",    iconBg: "bg-red-100",    icon: "text-red-600",    value: "text-red-900" },
  slate:  { bg: "bg-slate-50/60",  iconBg: "bg-slate-100",  icon: "text-slate-600",  value: "text-slate-900" },
};

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: "blue" | "yellow" | "orange" | "green" | "red" | "slate";
}

export default function StatCard({
  label,
  value,
  icon,
  color = "slate",
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className={cn("rounded-xl p-5 transition-all", c.bg)}>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-11 h-11 rounded-lg flex items-center justify-center shrink-0",
            c.iconBg, c.icon,
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
            {label}
          </p>
          <p className={cn("text-2xl font-black tabular-nums", c.value)}>
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
