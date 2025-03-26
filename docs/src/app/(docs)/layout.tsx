import { DocsLayout, DocsLayoutProps } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout {...docsOptions}>
      {children}
    </DocsLayout>
  );
}

const docsOptions: DocsLayoutProps = {
  ...baseOptions,
  tree: source.pageTree,
  sidebar: {
    tabs: {
      transform(option, node) {
        const meta = source.getNodeMeta(node);
        if (!meta) return option;

        const color = `var(--color-${getColorName(meta.file.dirname)})`;

        return {
          ...option,
          icon: (
            <div
              className="rounded-md p-1 shadow-lg ring-2 [&_svg]:size-5"
              style={
                {
                  color,
                  border: `1px solid color-mix(in oklab, ${color} 50%, transparent)`,
                  '--tw-ring-color': `color-mix(in oklab, ${color} 20%, transparent)`,
                } as object
              }
            >
              {node.icon}
            </div>
          ),
        };
      },
    },
  },
}

function getColorName(page: "gateway" | "tutorial" | string): string {
  if (page == "gateway") {
    return `emerald-600`;
  }

  return `fd-foreground`;
}

