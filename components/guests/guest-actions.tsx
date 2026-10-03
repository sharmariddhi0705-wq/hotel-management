"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestFormDialog, type EditableGuest } from "@/components/guests/guest-form";

/** Edit button on the guest profile page. */
export function GuestActions({ guest }: { guest: EditableGuest }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
        Edit guest
      </Button>
      <GuestFormDialog open={open} onOpenChange={setOpen} guest={guest} />
    </>
  );
}
