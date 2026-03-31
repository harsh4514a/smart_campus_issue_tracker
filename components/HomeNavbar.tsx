import Link from "next/link";
import Image from "next/image";

type NavAction = {
  label: string;
  href: string;
  variant?: "ghost" | "primary";
};

const defaultActions: NavAction[] = [
  { label: "Sign in", href: "/login", variant: "ghost" },
  { label: "Get Started", href: "/register", variant: "primary" },
];

interface HomeNavbarProps {
  actions?: NavAction[];
}

export default function HomeNavbar({ actions = defaultActions }: HomeNavbarProps) {
  const renderActionClass = (variant: NavAction["variant"]) => {
    if (variant === "primary") {
      return "px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition shadow-sm";
    }

    return "px-5 py-2 text-sm font-medium text-emerald-100 hover:text-white transition rounded-lg";
  };

  return (
    <header className="border-b border-emerald-700/50 bg-emerald-950/40 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center">
            <Image
              src="/images/logo1.png?v=2"
              alt="CampusTracker Logo"
              width={48}
              height={48}
              className="h-15 w-15 object-contain -m-1"
              style={{ transform: "scale(1.5)" }}
              priority
              unoptimized
            />
          </div>
          <span className="text-xl font-semibold text-white">CampusTracker</span>
        </Link>

        {actions.length > 0 && (
          <div className="flex items-center gap-3">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={renderActionClass(action.variant)}
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
