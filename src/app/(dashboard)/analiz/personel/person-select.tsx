"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PersonSelect({ people, value }: { people: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("kisi", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-[#5e5747]">
      <span className="font-medium">Kişi:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[#a99c7d]/40 bg-white px-2 py-1.5 text-sm text-[#474237]"
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
