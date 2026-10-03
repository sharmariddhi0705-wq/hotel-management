"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_SECTIONS } from "@/lib/navigation";

/**
 * Command palette for jumping between sections, opened with the button or ⌘K.
 * Destinations are taken from the nav config, so nothing can drift out of date.
 */
export function QuickSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label="Quick search"
      >
        {/* <Search className="size-4" /> */}
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Quick search">
        <CommandInput placeholder="Jump to a section…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          {NAV_SECTIONS.map((section, index) => (
            <CommandGroup
              key={section.heading ?? `group-${index}`}
              heading={section.heading ?? "Overview"}
            >
              {section.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.href}`}
                  onSelect={() => go(item.href)}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
