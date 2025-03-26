"use client";

import { Cards } from "fumadocs-ui/components/card";
import { useParams } from "next/navigation";
import { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function Body({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const mode = useMode();

  return (
    <body className={twMerge(mode, 'flex flex-col min-h-screen')}>
      {children}
    </body>
  );
}

export function useMode(): string | undefined {
  const { slug } = useParams();
  return Array.isArray(slug) && slug.length > 0 ? slug[0] : undefined;
}
