import {
  BatteryCharging,
  BedDouble,
  Bike,
  Bus,
  Car,
  CarTaxiFront,
  Clapperboard,
  Coffee,
  Cpu,
  CreditCard,
  Factory,
  GraduationCap,
  HeartPulse,
  Home,
  IndianRupee,
  Landmark,
  Lightbulb,
  MonitorPlay,
  Package,
  PieChart,
  Plane,
  Rocket,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Soup,
  Sparkles,
  Stethoscope,
  Store,
  TrainFront,
  TrendingUp,
  Trophy,
  Umbrella,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_QUESTION_ICON } from "@/lib/question-icon";
import { cn } from "@/lib/utils";

/**
 * Every icon name `iconNameForQuestion` can return, plus the 14 names used by
 * `Category.icon` as its fallback.
 *
 * Imported statically and by name so the bundler keeps only these — a dynamic
 * lookup against the lucide namespace would pull the entire icon set into the
 * client bundle.
 */
const ICONS: Record<string, LucideIcon> = {
  // Subject icons
  BatteryCharging,
  BedDouble,
  Bike,
  Car,
  CarTaxiFront,
  Clapperboard,
  Coffee,
  CreditCard,
  Home,
  Landmark,
  Lightbulb,
  MonitorPlay,
  Plane,
  ShoppingBag,
  Smartphone,
  Soup,
  Sparkles,
  Stethoscope,
  Store,
  TrainFront,
  Trophy,
  Umbrella,
  Utensils,
  Wallet,
  Wifi,
  // Category fallbacks (prisma/seed-data.ts)
  Bus,
  Cpu,
  Factory,
  GraduationCap,
  HeartPulse,
  IndianRupee,
  Package,
  PieChart,
  Rocket,
  ShoppingCart,
  TrendingUp,
  Users,
  Zap,
};

/**
 * Resolve a stored icon name. An unknown one degrades to the default rather
 * than throwing — `Category.icon` is hand-edited data, and a typo there
 * shouldn't take out the library page.
 */
export function questionIcon(name: string): LucideIcon {
  return ICONS[name] ?? ICONS[DEFAULT_QUESTION_ICON];
}

/**
 * The tile itself. Decorative: the title next to it already names the subject,
 * so it's hidden from screen readers rather than given a redundant label.
 */
export function QuestionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = questionIcon(name);
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10",
        className,
      )}
    >
      <Icon className="h-5 w-5 text-primary" />
    </div>
  );
}
