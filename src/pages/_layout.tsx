import { Outlet, NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { ThemeSelector } from "@/components/theme-selector"
import { useIsCoeAdmin } from "@/hooks/useCurrentUser"

const navSections = [
  {
    title: "Ideas",
    items: [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/my-ideas", label: "My Ideas" },
      { to: "/submit", label: "Submit Idea" },
    ],
  },
  {
    title: "Review",
    adminOnly: true,
    items: [
      { to: "/my-approvals", label: "My Approvals" },
    ],
  },
  {
    title: "Admin",
    adminOnly: true,
    items: [
      { to: "/analytics", label: "Analytics" },
      { to: "/ai-coe-team", label: "AI CoE Team" },
      { to: "/coe-roles", label: "AI CoE Roles" },
      { to: "/scorecard-config", label: "Scorecard Configuration" },
      { to: "/lookup-tables", label: "Normalized Idea Configuration" },
    ],
  },
]

export default function Layout() {
  const { isAdmin } = useIsCoeAdmin()
  const visibleSections = navSections.filter((s) => !s.adminOnly || isAdmin)
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 shrink-0 border-b flex items-center justify-between px-4">
        <span className="font-semibold text-sm tracking-tight">Agentic Fury</span>
        <ThemeSelector />
      </header>
      <div className="flex flex-1 min-h-0">
        <aside className="w-52 shrink-0 border-r flex flex-col">
          <nav className="flex-1 p-3 space-y-1">
            {visibleSections.map((section, sectionIndex) => (
              <div
                key={section.title}
                className={cn(
                  "space-y-1",
                  sectionIndex > 0 && "mt-3 pt-3 border-t"
                )}
              >
                <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </p>
                {section.items.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        "block px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}