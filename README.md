# Task Workflow Test

Development environment for task-based project work.

## Stack

- Node.js 22.22.2
- TypeScript
- Next.js App Router
- React with the React Compiler enabled
- shadcn/ui
- ESLint

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Start editing the app in `src/app/page.tsx`. The page auto-updates as you edit the file.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## UI Components

shadcn/ui is initialized with Tailwind CSS v4, the `base-nova` preset, and the `@/*` import alias. Add components with:

```bash
npx shadcn@latest add <component>
```

The starter `button` component is available at `src/components/ui/button.tsx`.

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
