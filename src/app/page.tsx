import { CheckCircle2Icon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

const stackItems = [
  "Next.js App Router",
  "TypeScript",
  "React Compiler",
  "shadcn/ui",
  "ESLint",
];

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            Task Workflow Test
          </p>
          <h1 className="text-center text-4xl font-semibold tracking-normal text-balance">
            Development environment ready
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            The project is configured for typed Next.js development with React
            Compiler support, shadcn/ui components, and linting.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {stackItems.map((item) => (
            <li
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground"
              key={item}
            >
              <CheckCircle2Icon
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              {item}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3">
          <a
            className={buttonVariants()}
            href="https://nextjs.org/docs"
            rel="noreferrer"
            target="_blank"
          >
            Next.js docs
          </a>
          <a
            className={buttonVariants({ variant: "outline" })}
            href="https://ui.shadcn.com/docs"
            rel="noreferrer"
            target="_blank"
          >
            shadcn/ui docs
          </a>
        </div>
      </section>
    </main>
  );
}
