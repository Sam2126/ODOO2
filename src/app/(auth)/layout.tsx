import { ArrowLeftRight, Boxes, History, PackageCheck } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: PackageCheck,
    title: "Receipts and deliveries",
    body: "Validate a document and stock moves on its own — no second spreadsheet to update.",
  },
  {
    icon: ArrowLeftRight,
    title: "Multi-warehouse transfers",
    body: "Main Store to Production Rack, Rack A to Rack B, Gurugram to Jaipur.",
  },
  {
    icon: History,
    title: "A ledger that explains itself",
    body: "Every movement is recorded against its document and can never be edited away.",
  },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — hidden on phones, where the form is the whole job. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground px-12 py-12 text-background lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-primary/25 blur-3xl"
        />
        <div className="relative flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="size-[1.1rem]" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">StockSense</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            Every change in stock is a movement between two locations.
          </h2>
          <p className="mt-3 text-sm/relaxed opacity-70">
            Receipts, deliveries, internal transfers and physical counts all run through one
            ledger, so the number on the screen is the number on the rack.
          </p>

          <ul className="mt-9 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background/10 ring-1 ring-background/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-0.5 block text-sm opacity-65">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs opacity-45">Inventory Management System</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
