import * as React from "react"
import { Toaster } from "sonner"
import { useTheme } from "@/hooks/use-theme"

type SonnerProviderProps = { children: React.ReactNode }

export function SonnerProvider({ children }: SonnerProviderProps) {
  const { theme } = useTheme();
  const sonnerTheme = theme === "dark" ? "dark" : theme === "system" ? "system" : "light";

  return (
    <>
      {children}
      <Toaster
        position="top-center"
        theme={sonnerTheme}
        richColors
        expand
        duration={3000}
        visibleToasts={3}
      />
    </>
  )
}