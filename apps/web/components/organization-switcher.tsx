"use client";

import { ChevronDown } from "lucide-react";
import type { Membership } from "@nodra/contracts";
import { Select } from "./ui";

export function OrganizationSwitcher({
  memberships,
  value,
  onChange,
  className,
  showChevron = false,
}: {
  memberships: readonly Membership[];
  value: string;
  onChange: (organizationId: string) => void;
  className?: string;
  showChevron?: boolean;
}) {
  return (
    <label className={className}>
      <span className="sr-only">Cambiar organización</span>
      <Select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {memberships.map((membership) => (
          <option key={membership.id} value={membership.organization.id}>
            {membership.organization.name}
          </option>
        ))}
      </Select>
      {showChevron && <ChevronDown size={15} aria-hidden="true" />}
    </label>
  );
}
