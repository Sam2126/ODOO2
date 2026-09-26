import { LogOut } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

import { ChangePasswordForm, ProfileDetailsForm } from "./profile-forms";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireUser();

  const [pickings, adjustments, moves] = await Promise.all([
    prisma.picking.count({ where: { createdById: user.id } }),
    prisma.adjustment.count({ where: { createdById: user.id } }),
    prisma.stockMove.count({ where: { createdById: user.id } }),
  ]);

  return (
    <>
      <PageHeader
        title="My profile"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={user.role === "MANAGER" ? "primary" : "neutral"}>
              {user.role === "MANAGER" ? "Inventory manager" : "Warehouse staff"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Member since {formatDate(user.createdAt)}
            </span>
          </span>
        }
        actions={
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              <LogOut aria-hidden />
              Log out
            </Button>
          </form>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Documents created", value: pickings },
          { label: "Counts recorded", value: adjustments },
          { label: "Movements booked", value: moves },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-surface px-4 py-3.5">
            <p className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
              {stat.label}
            </p>
            <p className="tabular mt-2 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader title="Details" description="Your name appears on every document you create." />
          <ProfileDetailsForm name={user.name} email={user.email} />
        </Card>

        <Card className="h-fit">
          <CardHeader
            title="Password"
            description="Changing it here does not sign you out of this device."
          />
          <ChangePasswordForm />
        </Card>
      </div>

      <Card>
        <CardHeader title="What your role can do" />
        <CardBody className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium">Everyone</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li>Create and validate receipts, deliveries and transfers</li>
              <li>Record inventory adjustments</li>
              <li>Add and edit products and reordering rules</li>
              <li>Read the full stock ledger</li>
            </ul>
          </div>
          <div>
            <p className="font-medium">Inventory managers only</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li>Create, edit and delete warehouses</li>
              <li>Add and remove locations inside a warehouse</li>
              <li>Manage product categories</li>
            </ul>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
